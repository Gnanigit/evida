import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from app.api.documents import BUCKET_NAME
from app.core.security import bearer_scheme, get_current_user
from app.ingestion.vector_store import delete_user_vectors
from app.services.supabase_client import get_user_supabase_client


router = APIRouter(prefix="/account", tags=["Account"])

STORAGE_PAGE_SIZE = 100
# Stops the loop if storage keeps listing files it will not delete.
MAX_STORAGE_PAGES = 1000


def purge_user_storage(bucket, user_id: str) -> int:
    """Delete every file in the user's storage folder ({user_id}/...).

    Uploads are stored as {user_id}/{document_id}.pdf. The bucket client is
    authenticated as the user, so storage policies also limit listing and
    deleting to their own folder. Returns the number of files removed.
    """

    # A valid UUID only: never an empty or partial prefix such as "" (bucket root).
    folder = str(uuid.UUID(user_id))
    removed = 0

    for _ in range(MAX_STORAGE_PAGES):
        # Always read the first page: each pass deletes what it listed.
        entries = bucket.list(folder, {"limit": STORAGE_PAGE_SIZE, "offset": 0})

        # Entries without an id are sub-folders, not files.
        paths = [
            f"{folder}/{entry['name']}"
            for entry in entries or []
            if entry.get("id") and entry.get("name")
        ]

        if not paths:
            return removed

        deleted = bucket.remove(paths)

        if not deleted:
            raise RuntimeError("Storage did not delete the user's files.")

        removed += len(deleted)

    raise RuntimeError("Too many storage files to delete in one request.")


# Permanently delete the signed-in user's account and all of their data.
@router.delete("/")
def delete_account(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    user_id = current_user["id"]
    user_supabase = get_user_supabase_client(credentials.credentials)

    # Order matters: external data first, the account last. If a step
    # fails, the account still exists and the user can retry; every step
    # is safe to repeat.
    try:
        # 1. Uploaded PDFs in Supabase Storage.
        files_removed = purge_user_storage(
            user_supabase.storage.from_(BUCKET_NAME),
            user_id,
        )

        # 2. Search index chunks in Chroma.
        delete_user_vectors(user_id)

        # 3. The auth user; profiles, conversations, messages and documents
        #    are removed by "on delete cascade" (migration 010).
        user_supabase.rpc("delete_current_user").execute()

    except Exception as exc:
        logging.exception("Account deletion failed for user %s", user_id)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Your account could not be deleted. Please try again.",
        ) from exc

    return {
        "message": "Account deleted.",
        "id": user_id,
        "files_removed": files_removed,
    }
