import logging
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import bearer_scheme, get_current_user
from app.services.supabase_client import get_user_supabase_client
from app.ingestion.pdf_loader import load_and_split_pdf
from app.ingestion.vector_store import add_documents_to_vector_store
from app.ingestion.vector_store import open_vector_store

router = APIRouter(prefix="/documents", tags=["Documents"])

BUCKET_NAME = "evida-documents"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# List library documents, one conversation's attachments, or (include_attachments)
# the library plus every chat attachment, each tagged with its conversation title.
@router.get("/")
def list_documents(
    conversation_id: str | None = Query(default=None),
    include_attachments: bool = Query(default=False),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):

    user_supabase = get_user_supabase_client(credentials.credentials)

    query = (
        user_supabase.table("documents")
        # conversations(title) embeds the linked conversation via the documents.conversation_id FK.
        .select(
            "id, filename, storage_path, content_type, created_at, indexed_at, "
            "conversation_id, conversations(title)"
        )
        .eq("user_id", current_user["id"])
    )

    if conversation_id:
        query = query.eq("conversation_id", conversation_id)
    elif not include_attachments:
        # Default: the library only (attachments stay in their chats).
        query = query.is_("conversation_id", "null")

    response = query.order("created_at", desc=True).execute()

    # Flatten the embedded conversation into a simple title field.
    documents = []
    for row in response.data or []:
        conversation = row.pop("conversations", None)
        row["conversation_title"] = conversation["title"] if conversation else None
        documents.append(row)

    return {"documents": documents}



# How long a document link stays valid (seconds).
SIGNED_URL_SECONDS = 60 * 10


# Return a short-lived link for viewing one of the user's own PDFs.
@router.get("/{document_id}/url")
def get_document_url(
    document_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    user_supabase = get_user_supabase_client(credentials.credentials)

    response = (
        user_supabase.table("documents")
        .select("id, storage_path")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    try:
        signed = user_supabase.storage.from_(BUCKET_NAME).create_signed_url(
            response.data[0]["storage_path"],
            SIGNED_URL_SECONDS,
        )
        url = signed.get("signedURL") or signed.get("signedUrl")
        if not url:
            raise RuntimeError("No signed URL returned.")
    except Exception as exc:
        logging.exception("Creating a document link failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document could not be opened.",
        ) from exc

    return {"url": url, "expires_in": SIGNED_URL_SECONDS}



# Upload a PDF and save its metadata.
@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    conversation_id: str | None = Form(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):

    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed.",
        )

    content = await file.read(MAX_FILE_SIZE + 1)

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="The file must be 10 MB or smaller.",
        )

    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file does not appear to be a valid PDF.",
        )

    user_supabase = get_user_supabase_client(credentials.credentials)

    if conversation_id:
        conversation_response = (
            user_supabase.table("conversations")
            .select("id")
            .eq("id", conversation_id)
            .eq("user_id", current_user["id"])
            .execute()
        )
        if not conversation_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )
        
    document_id = None
    storage_path = None

    try:
        import uuid

        document_id = str(uuid.uuid4())
        storage_path = f"{current_user['id']}/{document_id}.pdf"

        user_supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=content,
            file_options={
                "content-type": "application/pdf",
                "upsert": "false",
            },
        )

        response = (
            user_supabase.table("documents")
            .insert({
                "id": document_id,
                "user_id": current_user["id"],
                "filename": Path(file.filename).name,
                "storage_path": storage_path,
                "content_type": "application/pdf",
                "conversation_id": conversation_id,
            })
            .select("id, filename, storage_path, content_type, created_at, indexed_at")
            .execute()
        )

        if not response.data:
            raise RuntimeError("Document metadata was not saved.")

        return response.data[0]

    except Exception as exc:
        logging.exception("Document upload failed")

        if storage_path:
            try:
                user_supabase.storage.from_(BUCKET_NAME).remove(
                    [storage_path]
                )
            except Exception:
                logging.exception("Storage cleanup failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document could not be saved.",
        ) from exc

    finally:
        await file.close()


# Extract and index an owned PDF in the user's searchable document store.
@router.post("/{document_id}/index")
def index_document(
    document_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):

    user_supabase = get_user_supabase_client(credentials.credentials)

    # 1. Find the document and verify ownership.
    response = (
        user_supabase.table("documents")
        .select("id, filename, storage_path, indexed_at")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    document = response.data[0]
    temp_path = None

    try:
        # 2. Download the PDF from the private Storage bucket.
        content = user_supabase.storage.from_(BUCKET_NAME).download(
            document["storage_path"]
        )

        if not content:
            raise ValueError("The stored PDF is empty.")

        # 3. Save it temporarily so the existing PDF loader can read it.
        with tempfile.NamedTemporaryFile(
            suffix=".pdf",
            delete=False,
        ) as temp_file:
            temp_file.write(content)
            temp_path = Path(temp_file.name)

        # 4. Extract text and split it into chunks.
        chunks = load_and_split_pdf(temp_path)

        # Use the stored filename as the citation source.
        # Do not retain the temporary local path in the metadata.
        for chunk in chunks:
            chunk.metadata["source"] = document["filename"]

        # 5. Add chunks with ownership metadata.
        add_documents_to_vector_store(
            documents=chunks,
            user_id=current_user["id"],
            document_id=document["id"],
        )

        # 6. Save the successful indexing time.
        user_supabase.table("documents").update(
            {
                "indexed_at": datetime.now(timezone.utc).isoformat()
            }
        ).eq(
            "id", document["id"]
        ).eq(
            "user_id", current_user["id"]
        ).execute()


        return {
            "message": "Document indexed successfully.",
            "document_id": document["id"],
            "filename": document["filename"],
            "chunks_indexed": len(chunks),
        }

    except HTTPException:
        raise

    except Exception as exc:
        logging.exception("Document indexing failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document could not be indexed.",
        ) from exc

    finally:
        # 7. Always remove the temporary PDF.
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                logging.exception("Temporary PDF cleanup failed")


# Delete a document and its indexed chunks.
@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):

    user_supabase = get_user_supabase_client(credentials.credentials)

    # 1. Find the document and verify ownership.
    response = (
        user_supabase.table("documents")
        .select("id, storage_path")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    document = response.data[0]

    try:
        # 2. Delete only this user's chunks for this document.
        vector_store = open_vector_store()

        vector_store.delete(
            where={
                "$and": [
                    {"user_id": current_user["id"]},
                    {"document_id": document_id},
                ]
            }
        )

        # 3. Delete the PDF from Supabase Storage.
        user_supabase.storage.from_(BUCKET_NAME).remove(
            [document["storage_path"]]
        )

        # 4. Delete the document metadata.
        user_supabase.table("documents").delete().eq(
            "id", document_id
        ).eq(
            "user_id", current_user["id"]
        ).execute()

    except Exception as exc:
        logging.exception("Document deletion failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document could not be deleted completely.",
        ) from exc

    return {
        "message": "Document and indexed chunks deleted successfully.",
        "id": document_id,
    }