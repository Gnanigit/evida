from unittest.mock import patch

from app.graph.nodes.web_search import web_search_node


def test_web_search_returns_controlled_error_when_tavily_fails():
    state = {
        "question": "What are the latest AI developments?",
    }

    with patch(
        "app.graph.nodes.web_search.TavilySearch",
        side_effect=RuntimeError("Internal test error"),
    ):
        result = web_search_node(state)

    assert result["technical_error"] == (
        "Web search failed due to a technical issue."
    )
    assert result["context"] == []
    assert result["sources"] == []
    assert "Internal test error" not in str(result)