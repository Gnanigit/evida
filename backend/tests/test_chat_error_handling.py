from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.main import app
from app.api import chat as chat_api
from app.core.security import get_current_user, bearer_scheme


class FakeQuery:
    def __init__(self, table_name):
        self.table_name = table_name
        self.inserted_data = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def insert(self, data):
        self.inserted_data = data
        return self

    def execute(self):
        if self.table_name == "conversations":
            return SimpleNamespace(data=[{"id": "test-conversation"}])

        if self.table_name == "messages":
            return SimpleNamespace(
                data=[
                    {
                        "id": "test-message",
                        **self.inserted_data,
                    }
                ]
            )

        return SimpleNamespace(data=[])


class FakeSupabase:
    def table(self, table_name):
        return FakeQuery(table_name)


def test_chat_returns_controlled_error_when_graph_fails(monkeypatch):
    def fail_graph(*args, **kwargs):
        raise RuntimeError("Internal test error")

    monkeypatch.setattr(chat_api.graph, "invoke", fail_graph)
    monkeypatch.setattr(
        chat_api,
        "get_user_supabase_client",
        lambda token: FakeSupabase(),
    )

    app.dependency_overrides[get_current_user] = lambda: {
        "id": "test-user",
        "email": "test@example.com",
    }
    app.dependency_overrides[bearer_scheme] = lambda: (
        __import__("fastapi.security", fromlist=["HTTPAuthorizationCredentials"])
        .HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="test-token",
        )
    )

    try:
        with TestClient(app) as client:
            response = client.post(
                "/chat/",
                json={
                    "conversation_id": "test-conversation",
                    "question": "Test graph failure",
                },
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(bearer_scheme, None)

    assert response.status_code == 500
    assert response.json() == {
        "detail": "Evida could not process or save the conversation."
    }
    assert "Internal test error" not in response.text