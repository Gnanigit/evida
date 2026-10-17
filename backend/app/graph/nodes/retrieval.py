from langchain_core.runnables import RunnableConfig
from app.graph.state import EvidaState

from app.ingestion.vector_store import (
    DEFAULT_DB_PATH,
    open_vector_store,
    search_documents
)

# config is for testing the retrieval node and rag flow, In real usage it directly uses the 'DEFAULT_DB_PATH'
def retrieval_node(
    state: EvidaState,
    config: RunnableConfig | None = None,
) -> dict:
    """Retrieve relevant document chunks from Chroma."""

    configurable = (config or {}).get("configurable", {})
    persist_directory = configurable.get(
        "persist_directory",
        str(DEFAULT_DB_PATH),
    )

    query = state.get("rewritten_query") or state["question"]

    attempts = state.get("retrieval_attempts", 0) + 1

    vector_store = open_vector_store(persist_directory)

    documents = search_documents(
        vector_store=vector_store,
        question=query,
        k=3,
    )

    return {
        "context": [
            document.page_content for document in documents
        ],
        "sources": [
            {
                "source": document.metadata.get("source", "unknown"),
                "page": document.metadata.get("page"),
            }
            for document in documents
        ],
        "retrieval_attempts": attempts,
    }
