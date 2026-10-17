from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.core.security import bearer_scheme, get_current_user
from app.services.supabase_client import get_user_supabase_client
from app.graph.workflow import graph


router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    conversation_id: str
    question: str = Field(min_length=1, max_length=10000)


@router.post("/")
def chat(
    request: ChatRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    # Run Evida and save both messages to the user's conversation.

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    user_supabase = get_user_supabase_client(credentials.credentials)
    user_id = current_user["id"]

    try:
        # 1. Verify that this conversation belongs to the user.
        conversation_response = (
            user_supabase.table("conversations")
            .select("id")
            .eq("id", request.conversation_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not conversation_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        # 2. Save the user's question.
        user_message_response = (
            user_supabase.table("messages")
            .insert({
                "conversation_id": request.conversation_id,
                "user_id": user_id,
                "role": "user",
                "content": request.question,
            })
            .select("id, conversation_id, role, content, sources, created_at")
            .execute()
        )

        if not user_message_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not save the user message.",
            )

        user_message_id = user_message_response.data[0]["id"]

        # 3. Run the existing LangGraph workflow.
        result = graph.invoke(
            {"question": request.question},
            config={
                "configurable": {
                    "user_id": user_id,
                }
            },
        )

        answer = (
            result.get("verified_answer")
            or result.get("answer", "")
        )

        # 4. Save Evida's answer to the same conversation.
        assistant_message_response = (
            user_supabase.table("messages")
            .insert({
                "conversation_id": request.conversation_id,
                "user_id": user_id,
                "role": "assistant",
                "content": answer,
                "sources": result.get("sources", []),
            })
            .select("id, conversation_id, role, content, sources, created_at")
            .execute()
        )

        if not assistant_message_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not save the assistant response.",
            )

        # 5. Update the conversation's last-updated time.
        try:
            user_supabase.table("conversations").update(
                {"updated_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", request.conversation_id).eq(
                "user_id", user_id
            ).execute()
        except Exception:
            logging.exception(
                "Failed to update the conversation timestamp."
            )

        return {
            "conversation_id": request.conversation_id,
            "question": request.question,
            "answer": answer,
            "sources": result.get("sources", []),
            "messages": [
                user_message_response.data[0],
                assistant_message_response.data[0],
            ],
        }

    except HTTPException:
        if "user_message_id" in locals():
            try:
                user_supabase.table("messages").delete().eq(
                    "id", user_message_id
                ).eq(
                    "user_id", user_id
                ).eq(
                    "conversation_id", request.conversation_id
                ).execute()
            except Exception:
                logging.exception(
                    "Failed to delete the user message after processing failed."
                )
        raise

    except Exception as exc:
        if "user_message_id" in locals():
            try:
                user_supabase.table("messages").delete().eq(
                    "id", user_message_id
                ).eq(
                    "user_id", user_id
                ).eq(
                    "conversation_id", request.conversation_id
                ).execute()
            except Exception:
                logging.exception(
                    "Failed to delete the user message after processing failed."
                )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Evida could not process or save the conversation.",
        ) from exc