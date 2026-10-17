
from getpass import getpass

from app.services.supabase_client import supabase


def main():
    email = input("Test user email: ")
    password = getpass("Test user password: ")

    try:
        response = supabase.auth.sign_in_with_password(
            {
                "email": email,
                "password": password,
            }
        )

        if response.session is None:
            print("Sign-in failed: no session returned.")
            return

        print("Sign-in successful.")
        print("User ID:", response.user.id)
        print("Access token obtained successfully.")

        # Keep the token in memory for testing.
        access_token = response.session.access_token
        print("Token length:", len(access_token))
        print("Access token:", access_token)

    except Exception as exc:
        print("Sign-in failed:", str(exc))


if __name__ == "__main__":
    main()
