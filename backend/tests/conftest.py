import uuid

import chromadb
import pytest
from langchain_chroma import Chroma

import app.graph.nodes.retrieval as retrieval
import app.ingestion.vector_store as vector_store


# Keep tests off Chroma Cloud: give each test its own in-memory collection.
@pytest.fixture(autouse=True)
def local_vector_store(monkeypatch):
    store = Chroma(
        collection_name=f"test_{uuid.uuid4().hex}",
        embedding_function=vector_store.get_embeddings(),
        client=chromadb.EphemeralClient(),
    )

    # retrieval.py imports the function by name, so patch both modules.
    # Accepts with_embeddings like the real function; both modes share the test store.
    monkeypatch.setattr(vector_store, "open_vector_store", lambda *_, **__: store)
    monkeypatch.setattr(retrieval, "open_vector_store", lambda *_, **__: store)

    return store
