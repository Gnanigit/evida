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

def create_vector_store(
    documents: list[Document],
    persist_directory: str | Path = DEFAULT_DB_PATH,
) -> Chroma:
    embeddings = get_embeddings()

    vector_store = Chroma(
        collection_name=settings.collection_name,
        embedding_function=embeddings,
        persist_directory=str(persist_directory),
    )

    vector_store.delete_collection()

    return Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        collection_name=settings.collection_name,
        persist_directory=str(persist_directory),
    )

# Open an existing Chroma store without re-indexing documents.
def open_vector_store(
    persist_directory : str | Path = DEFAULT_DB_PATH
) -> Chroma:
    return Chroma(
        collection_name=settings.collection_name,
        embedding_function=get_embeddings(),
        persist_directory=str(persist_directory),
    )


def search_documents(
    vector_store: Chroma,
    question: str,
    k: int = 3,
) -> list[Document]:
    # Return the most relevant document chunks for a question.

    return vector_store.similarity_search(
        query=question,
        k=k,
    )
