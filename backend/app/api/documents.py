import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import bearer_scheme, get_current_user
from app.services.supabase_client import get_user_supabase_client
from app.ingestion.pdf_loader import load_and_split_pdf
from app.ingestion.vector_store import add_documents_to_vector_store
from app.ingestion.vector_store import open_vector_store

router = APIRouter(prefix="/documents", tags=["Documents"])

BUCKET_NAME = "evida-documents"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.get("/")
def list_documents(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    """List documents belonging to the authenticated user."""

    user_supabase = get_user_supabase_client(credentials.credentials)

    response = (
        user_supabase.table("documents")
        .select("id, filename, storage_path, content_type, created_at")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    return {"documents": response.data}


# Upload a PDF and save its metadata.
@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
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
            })
            .select("id, filename, storage_path, content_type, created_at")
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
        .select("id, filename, storage_path")
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
        # 6. Always remove the temporary PDF.
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