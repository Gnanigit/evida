
from unittest.mock import Mock

import app.graph.nodes as nodes
from app.graph.nodes import rewrite_query_node


def test_rewrite_query_returns_rewritten_query(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = (
        "customer growth rate and trends in the report"
    )

    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = {
        "question": "What does the report say about customer growth?",
        "route": "retrieval",
        "context": ["Unrelated document content"],
        "sources": [],
        "evidence_grade": "irrelevant",
        "answer": "",
    }

    result = rewrite_query_node(state)

    assert result["rewritten_query"] == (
        "customer growth rate and trends in the report"
    )
    mock_llm.invoke.assert_called_once()


def test_rewrite_query_falls_back_when_response_is_empty(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = "   "

    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = {
        "question": "What does the report say about customer growth?",
        "route": "retrieval",
        "context": [],
        "sources": [],
        "evidence_grade": "irrelevant",
        "answer": "",
    }

    result = rewrite_query_node(state)

    assert result["rewritten_query"] == state["question"]
