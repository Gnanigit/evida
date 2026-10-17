
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.security import get_current_user
from app.api.conversations import router as conversations_router
from app.api.messages import router as messages_router
from app.api.documents import router as documents_router
from app.api.chat import router as chat_router

app = FastAPI(
    title="Evida API",
    description="Evidence-grounded answers from documents and the web.",
    version="0.1.0",
)

# Allow only the configured frontend origins. Auth uses bearer tokens, not cookies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(conversations_router)
app.include_router(messages_router)
app.include_router(documents_router)
app.include_router(chat_router)

@app.get("/")
def root():
    return {"message": "Welcome to Evida API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user