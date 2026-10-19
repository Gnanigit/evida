from functools import lru_cache

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from app.core.config import settings


# Load the embedding model once per process.
@lru_cache(maxsize=1)
def get_embeddings() -> HuggingFaceEmbeddings:
    # Create the embedding model used for indexing and searching.
    return HuggingFaceEmbeddings(
        model_name = settings.embedding_model
    )


# Reuse one Chroma Cloud connection across requests.
@lru_cache(maxsize=1)
def open_vector_store() -> Chroma:
    return Chroma(
        collection_name=settings.collection_name,
        embedding_function=get_embeddings(),
        chroma_cloud_api_key=settings.chroma_api_key,
        tenant=settings.chroma_tenant,
        database=settings.chroma_database,
    )


def add_documents_to_vector_store(
    documents: list[Document],
    user_id: str,
    document_id: str,
) -> Chroma:
    vector_store = open_vector_store()

    if not documents:
        return vector_store

    prepared_documents = [
        Document(
            page_content=document.page_content,
            metadata={
                **document.metadata,
                "user_id": user_id,
                "document_id": document_id,
            },
        )
        for document in documents
    ]

    vector_store.delete(
        where={
            "$and": [
                {"user_id": user_id},
                {"document_id": document_id},
            ]
        }
    )

    chunk_ids = [
        f"{document_id}:{index}"
        for index in range(len(prepared_documents))
    ]

    vector_store.add_documents(
        documents=prepared_documents,
        ids=chunk_ids,
    )

    return vector_store


def create_vector_store(
    documents: list[Document],
    user_id: str,
    document_id: str,
) -> Chroma:
    """Create or update the store for a specific document."""

    return add_documents_to_vector_store(
        documents=documents,
        user_id=user_id,
        document_id=document_id,
    )

def delete_user_vectors(user_id: str) -> None:
    """Delete every chunk owned by this user (all of their documents)."""

    # Never run an unfiltered delete: an empty id must fail, not match nothing or everything.
    if not user_id:
        raise ValueError("A user_id is required to delete vectors.")

    open_vector_store().delete(where={"user_id": user_id})


def search_documents(
    vector_store: Chroma,
    question: str,
    user_id: str,
    k: int = 3,
    document_ids: list[str] | None = None,
) -> list[Document]:
    # Return the most relevant chunks, optionally limited to specific documents.
    if document_ids is None:
        search_filter = {"user_id": user_id}
    elif not document_ids:
        # Nothing this conversation is allowed to search.
        return []
    
    else:
        search_filter = {
            "$and": [
                {"user_id": user_id},
                {"document_id": {"$in": document_ids}},
            ]
        }

    return vector_store.similarity_search(
        query=question,
        k=k,
        filter=search_filter,
    )
