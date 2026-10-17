from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from pathlib import Path
from app.core.config import settings


# Resolve the storage path relative to the backend folder.
DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "chroma_db"


def get_embeddings() -> HuggingFaceEmbeddings:
    # Create the embedding model used for indexing and searching.
    return HuggingFaceEmbeddings(
        model_name = settings.embedding_model
    )


def open_vector_store(
    persist_directory: str | Path = DEFAULT_DB_PATH,
) -> Chroma:
    """Open an existing Chroma store or create its collection."""
    return Chroma(
        collection_name=settings.collection_name,
        embedding_function=get_embeddings(),
        persist_directory=str(persist_directory),
    )


def add_documents_to_vector_store(
    documents: list[Document],
    user_id: str,
    document_id: str,
    persist_directory: str | Path = DEFAULT_DB_PATH,
) -> Chroma:
    # Replace a document's chunks without affecting other documents.
    vector_store = open_vector_store(persist_directory)

    if not documents:
        return vector_store

    # Add ownership information to every chunk.
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

    # Delete only chunks belonging to this user and document.
    vector_store.delete(
        where={
            "$and": [
                {"user_id": user_id},
                {"document_id": document_id},
            ]
        }
    )

    # Use predictable IDs so each chunk has a stable identity.
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
    persist_directory: str | Path = DEFAULT_DB_PATH,
) -> Chroma:
    """Create or update the store for a specific document."""

    return add_documents_to_vector_store(
        documents=documents,
        user_id=user_id,
        document_id=document_id,
        persist_directory=persist_directory,
    )

def search_documents(
    vector_store: Chroma,
    question: str,
    user_id: str,
    k: int = 3,
) -> list[Document]:
    # Return the most relevant document chunks for a question.

    return vector_store.similarity_search(
        query=question,
        k=k,
        filter={"user_id": user_id},
    )
