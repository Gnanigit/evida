import pytest
from langchain_core.documents import Document

import app.ingestion.vector_store as vector_store_module
from app.api.account import purge_user_storage
from app.ingestion.vector_store import (
    add_documents_to_vector_store,
    delete_user_vectors,
    open_vector_store,
)

# Captured at import, before conftest's autouse fixture swaps in the test store.
real_open_vector_store = vector_store_module.open_vector_store

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"


class FakeBucket:
    """In-memory stand-in for a Supabase storage bucket (flat {folder}/{file} paths)."""

    def __init__(self, paths):
        self.paths = set(paths)

    def list(self, folder, options):
        names = sorted(
            path.split("/", 1)[1]
            for path in self.paths
            if path.startswith(f"{folder}/")
        )
        limit = options["limit"]
        return [{"id": name, "name": name} for name in names[:limit]]

    def remove(self, paths):
        deleted = [path for path in paths if path in self.paths]
        self.paths -= set(deleted)
        return [{"name": path} for path in deleted]


def test_purge_user_storage_removes_only_that_users_folder():
    files_a = [f"{USER_A}/doc-{index}.pdf" for index in range(250)]
    files_b = [f"{USER_B}/doc-1.pdf", f"{USER_B}/doc-2.pdf"]
    bucket = FakeBucket(files_a + files_b)

    removed = purge_user_storage(bucket, USER_A)

    # Every page of User A's files is gone; User B's files are untouched.
    assert removed == 250
    assert bucket.paths == set(files_b)


def test_purge_user_storage_rejects_invalid_user_id():
    bucket = FakeBucket([f"{USER_B}/doc-1.pdf"])

    # An empty id would otherwise list the bucket root.
    for bad_id in ("", "not-a-uuid"):
        with pytest.raises(ValueError):
            purge_user_storage(bucket, bad_id)

    assert bucket.paths == {f"{USER_B}/doc-1.pdf"}


def test_purge_user_storage_fails_if_storage_refuses():
    class RefusingBucket(FakeBucket):
        def remove(self, paths):
            return []

    bucket = RefusingBucket([f"{USER_A}/doc-1.pdf"])

    with pytest.raises(RuntimeError):
        purge_user_storage(bucket, USER_A)


def test_delete_user_vectors_removes_only_that_users_chunks():
    for user_id, document_id in ((USER_A, "doc-a"), (USER_B, "doc-b")):
        add_documents_to_vector_store(
            documents=[Document(page_content=f"Notes for {user_id}.")],
            user_id=user_id,
            document_id=document_id,
        )

    delete_user_vectors(USER_A)

    store = open_vector_store()
    assert store.get(where={"user_id": USER_A})["ids"] == []
    assert store.get(where={"user_id": USER_B})["ids"] == ["doc-b:0"]


def test_delete_mode_never_loads_the_embedding_model(monkeypatch):
    # Loading the model ran the 512 MB Render instance out of memory on delete.
    def no_model():
        raise AssertionError("the embedding model must not load for deletes")

    created = {}

    class FakeChroma:
        def __init__(self, **kwargs):
            created.update(kwargs)

    monkeypatch.setattr(vector_store_module, "get_embeddings", no_model)
    monkeypatch.setattr(vector_store_module, "Chroma", FakeChroma)
    real_open_vector_store.cache_clear()
    try:
        real_open_vector_store(with_embeddings=False)
    finally:
        real_open_vector_store.cache_clear()

    assert created["embedding_function"] is None


def test_delete_user_vectors_requires_user_id():
    with pytest.raises(ValueError):
        delete_user_vectors("")
