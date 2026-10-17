from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def preflight(origin):
    return client.options(
        "/auth/me",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )


def test_cors_allows_local_frontend_origin():
    response = preflight("http://localhost:5173")

    assert response.status_code == 200
    assert (
        response.headers["access-control-allow-origin"]
        == "http://localhost:5173"
    )


def test_cors_rejects_unknown_origin():
    response = preflight("https://evil.example.com")

    assert "access-control-allow-origin" not in response.headers


def test_auth_me_still_requires_token():
    response = client.get(
        "/auth/me",
        headers={"Origin": "http://localhost:5173"},
    )

    assert response.status_code == 401
