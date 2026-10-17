from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from app.core.security import bearer_scheme, get_current_user
from app.services.supabase_client import get_user_supabase_client

router = APIRouter(prefix="/conversations/{conversation_id}/messages", tags=["Messages"])


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=20000)

@router.get("/")
def list_messages(
    conversation_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    # List messages for a conversation owned by the authenticated user.

    user_supabase = get_user_supabase_client(credentials.credentials)

    conversation_response = (
        user_supabase.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not conversation_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    messages_response = (
        user_supabase.table("messages")
        .select("id, conversation_id, role, content, created_at")
        .eq("conversation_id", conversation_id)
        .eq("user_id", current_user["id"])
        .order("created_at")
        .execute()
    )

    return {"messages": messages_response.data}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_message(
    conversation_id: str,
    message: MessageCreate,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    # Create a user message in a conversation owned by the authenticated user.

    user_supabase = get_user_supabase_client(credentials.credentials)

    conversation_response = (
        user_supabase.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not conversation_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    response = (
        user_supabase.table("messages")
        .insert({
            "conversation_id": conversation_id,
            "user_id": current_user["id"],
            "role": "user",
            "content": message.content,
        })
        .select("id, conversation_id, role, content, created_at")
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Message could not be created.",
        )

    user_supabase.table("conversations").update(
    {"updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", conversation_id).eq(
        "user_id", current_user["id"]
    ).execute()

    return response.data[0]