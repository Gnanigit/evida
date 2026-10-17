
from supabase import Client, create_client

from app.core.config import settings


supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_publishable_key,
)

# Create a Supabase client authenticated as the supplied user.
from supabase import Client, create_client
from supabase.client import ClientOptions

from app.core.config import settings


supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_publishable_key,
)


def get_user_supabase_client(access_token: str) -> Client:
    """Create a Supabase client authenticated as the supplied user."""

    return create_client(
        settings.supabase_url,
        settings.supabase_publishable_key,
        options=ClientOptions(
            headers={
                "Authorization": f"Bearer {access_token}",
            }
        ),
    )