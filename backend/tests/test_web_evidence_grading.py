
from unittest.mock import Mock

import app.graph.nodes as nodes
from app.graph.nodes import web_evidence_grade_node


def make_state(context):
    return {
        "question": "What are the main findings about customer growth?",
        "route": "retrieval",
        "context": context,
        "sources": [],
        "evidence_grade": None,
        "answer": "",
    }


def test_web_evidence_is_relevant(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = "relevant"
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state([
        "Title: Growth report\n"
        "URL: https://example.com/report\n"
        "Content: Customer growth increased by 15% during the year."
    ])

    result = web_evidence_grade_node(state)

    assert result["evidence_grade"] == "relevant"
    mock_llm.invoke.assert_called_once()


def test_web_evidence_is_irrelevant(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = "irrelevant"
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state([
        "Title: Gardening tips\n"
        "URL: https://example.com/gardening\n"
        "Content: How to grow tomatoes at home."
    ])

    result = web_evidence_grade_node(state)

    assert result["evidence_grade"] == "irrelevant"


def test_empty_web_evidence_is_irrelevant(monkeypatch):
    mock_llm = Mock()
    monkeypatch.setattr(nodes, "llm", mock_llm)

    result = web_evidence_grade_node(make_state([]))

    assert result["evidence_grade"] == "irrelevant"
    mock_llm.invoke.assert_not_called()


def test_invalid_grade_defaults_to_irrelevant(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = "uncertain"
    monkeypatch.setattr(nodes, "llm", mock_llm)

    result = web_evidence_grade_node(
        make_state(["Some web evidence"])
    )

    assert result["evidence_grade"] == "irrelevant"
