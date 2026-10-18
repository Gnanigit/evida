from langchain_core.documents import Document

from app.ingestion.vector_store import (
    add_documents_to_vector_store,
    open_vector_store,
    search_documents,
)


def test_users_can_only_search_their_own_documents():
    # Add a document for User A.
    add_documents_to_vector_store(
        documents=[
            Document(
                page_content=(
                    "The astronomy research project studies "
                    "planets and distant galaxies."
                )
            )
        ],
        user_id="user-a",
        document_id="document-a",
    )

    # Add a similar document for User B.
    add_documents_to_vector_store(
        documents=[
            Document(
                page_content=(
                    "The astronomy research project studies "
                    "planets and distant stars."
                )
            )
        ],
        user_id="user-b",
        document_id="document-b",
    )

    vector_store = open_vector_store()

    # Search as User A.
    results_a = search_documents(
        vector_store=vector_store,
        question="astronomy research project planets",
        user_id="user-a",
        k=5,
    )

    # Search as User B.
    results_b = search_documents(
        vector_store=vector_store,
        question="astronomy research project planets",
        user_id="user-b",
        k=5,
    )

    # Each user should retrieve their own document only.
    assert results_a
    assert results_b

    assert all(
        document.metadata["user_id"] == "user-a"
        for document in results_a
    )
    assert all(
        document.metadata["document_id"] == "document-a"
        for document in results_a
    )

    assert all(
        document.metadata["user_id"] == "user-b"
        for document in results_b
    )
    assert all(
        document.metadata["document_id"] == "document-b"
        for document in results_b
    )