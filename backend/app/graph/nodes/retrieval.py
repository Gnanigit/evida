from langchain_core.runnables import RunnableConfig

from app.graph.state import EvidaState
from app.ingestion.vector_store import (
    DEFAULT_DB_PATH,
    open_vector_store,
    search_documents,
)


# Retrieve relevant chunks from the authenticated user's documents.
def retrieval_node(
    state: EvidaState,
    config: RunnableConfig | None = None,
) -> dict:

    configurable = (config or {}).get("configurable", {})

    # Resolve settings for this retrieval operation.
    persist_directory = configurable.get(
        "persist_directory",
        str(DEFAULT_DB_PATH),
    )
    user_id = configurable.get("user_id")
    document_ids = configurable.get("document_ids")
    if not user_id:
        raise ValueError(
            "A user_id must be provided to retrieve private documents."
        )

    query = (
        state.get("rewritten_query")
        or state.get("current_question")
        or state["question"]
    )

    attempts = state.get("retrieval_attempts", 0) + 1

    vector_store = open_vector_store(persist_directory)

    documents = search_documents(
        vector_store=vector_store,
        question=query,
        user_id=user_id,
        k=3,
        document_ids=document_ids,
    )

    return {
        "context": [
            document.page_content for document in documents
        ],
        "sources": [
            {
                "source": document.metadata.get("source", "unknown"),
                "page": document.metadata.get("page"),
                "document_id": document.metadata.get("document_id"),
            }
            for document in documents
        ],
        "retrieval_attempts": attempts,
    }