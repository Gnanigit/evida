from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import bearer_scheme, get_current_user
from app.services.supabase_client import get_user_supabase_client

import logging

from app.api.documents import BUCKET_NAME
from app.ingestion.vector_store import open_vector_store

router = APIRouter(prefix="/conversations", tags=["Conversations"])

class ConversationCreate(BaseModel):
    title: str = Field(default="New conversation", min_length=1, max_length=200)

class RenameConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)

class PinConversationRequest(BaseModel):
    is_pinned: bool

@router.get("/")
def list_conversations(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    """List conversations belonging to the authenticated user."""

    user_supabase = get_user_supabase_client(credentials.credentials)

    response = (
        user_supabase.table("conversations")
        .select("id, title, created_at, updated_at, is_pinned")
        .eq("user_id", current_user["id"])
        .order("is_pinned", desc=True)
        .order("updated_at", desc=True)
        .execute()
    )

    return {"conversations": response.data}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_conversation(
    conversation: ConversationCreate,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    # Create a conversation for the authenticated user.

    user_supabase = get_user_supabase_client(credentials.credentials)

    response = (
        user_supabase.table("conversations")
        .insert({
            "user_id": current_user["id"],
            "title": conversation.title,
        })
        .select("id, title, created_at, updated_at")
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Conversation could not be created.",
        )

    return response.data[0]

# Rename a conversation belonging to the authenticated user.
@router.patch("/{conversation_id}")
def rename_conversation(
    conversation_id: str,
    request: RenameConversationRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    title = request.title.strip()

    if not title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Conversation title cannot be empty.",
        )

    user_supabase = get_user_supabase_client(credentials.credentials)

    response = (
        user_supabase.table("conversations")
        .update({"title": title})
        .eq("id", conversation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    return {
        "message": "Conversation renamed successfully.",
        "conversation": response.data[0],
    }

# Delete a conversation belonging to the authenticated user.
@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):

    user_supabase = get_user_supabase_client(credentials.credentials)

    # Remove this conversation's attachments: search chunks and stored files.
    # Their database rows go with the conversation (ON DELETE CASCADE).
    attachments = (
        user_supabase.table("documents")
        .select("id, storage_path")
        .eq("user_id", current_user["id"])
        .eq("conversation_id", conversation_id)
        .execute()
    ).data or []

    if attachments:
        try:
            # Deletes need no embeddings: skip loading the model (memory).
            vector_store = open_vector_store(with_embeddings=False)
            for attachment in attachments:
                vector_store.delete(
                    where={
                        "$and": [
                            {"user_id": current_user["id"]},
                            {"document_id": attachment["id"]},
                        ]
                    }
                )
            user_supabase.storage.from_(BUCKET_NAME).remove(
                [attachment["storage_path"] for attachment in attachments]
            )
        except Exception:
            # Leftover chunks are never searched (their document rows are gone),
            # so log and continue with the conversation delete.
            logging.exception("Attachment cleanup failed")

    response = (
        user_supabase.table("conversations")
        .delete()
        .eq("id", conversation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    return {
        "message": "Conversation deleted successfully.",
        "id": conversation_id,
    }

@router.patch("/{conversation_id}/pin")
def pin_conversation(
    conversation_id: str,
    request: PinConversationRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    """Pin or unpin a conversation owned by the authenticated user."""

    user_supabase = get_user_supabase_client(credentials.credentials)

    response = (
        user_supabase.table("conversations")
        .update({"is_pinned": request.is_pinned})
        .eq("id", conversation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    return {
        "message": (
            "Conversation pinned successfully."
            if request.is_pinned
            else "Conversation unpinned successfully."
        ),
        "conversation": response.data[0],
    }