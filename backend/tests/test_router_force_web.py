import app.graph.nodes.router as router


def test_force_web_routes_to_web_without_llm(monkeypatch):
    # The LLM must not be consulted when the user turned on web search.
    def fail(*args, **kwargs):
        raise AssertionError("router LLM should not be called")

    monkeypatch.setattr(router, "llm", type("NoLLM", (), {"invoke": fail})())

    result = router.router_node(
        {"question": "What is 2 + 2?", "force_web": True}
    )

    assert result == {"route": "web"}
