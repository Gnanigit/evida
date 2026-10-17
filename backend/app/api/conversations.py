from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import bearer_scheme, get_current_user
from app.services.supabase_client import get_user_supabase_client

router = APIRouter(prefix="/conversations", tags=["Conversations"])

class ConversationCreate(BaseModel):
    title: str = Field(default="New conversation", min_length=1, max_length=200)
    
@router.get("/")
def list_conversations(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    """List conversations belonging to the authenticated user."""

    user_supabase = get_user_supabase_client(credentials.credentials)

    response = (
        user_supabase.table("conversations")
        .select("id, title, created_at, updated_at")
        .eq("user_id", current_user["id"])
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


# Delete a conversation belonging to the authenticated user.
@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    """"""

    user_supabase = get_user_supabase_client(credentials.credentials)

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