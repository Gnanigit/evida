from pydantic_settings import BaseSettings, SettingsConfigDict
class Settings(BaseSettings):
    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"
    embedding_model : str = "sentence-transformers/all-MiniLM-L6-v2"
    collection_name : str = "evida_documents"
    tavily_api_key: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
