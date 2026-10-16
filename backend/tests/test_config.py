
from app.core.config import settings


def test_embedding_configuration():
    assert (
        settings.embedding_model
        == "sentence-transformers/all-MiniLM-L6-v2"
    )
    assert settings.collection_name == "evida_documents"
    assert settings.groq_model == "openai/gpt-oss-120b"
