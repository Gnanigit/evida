from pydantic_settings import BaseSettings, SettingsConfigDict
class Settings(BaseSettings):
    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"
    embedding_model : str = "sentence-transformers/all-MiniLM-L6-v2"
    collection_name : str = "evida_documents"
    tavily_api_key: str
    supabase_url: str
    supabase_publishable_key: str
    chroma_api_key: str
    chroma_tenant: str
    chroma_database: str
    # Browser origins allowed to call the API. Override with a JSON list in .env.
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://evida-virid.vercel.app"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
