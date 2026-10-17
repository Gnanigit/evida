from unittest.mock import Mock

import app.graph.nodes.answer_generation as nodes
from app.graph.nodes.answer_generation import web_answer_node

def make_state(context):
    return {
        "question": "What are the main findings about customer growth?",
        "route": "retrieval",
        "context": context,
        "sources": [
            {
                "source": "Growth report",
                "url": "https://example.com/report",
                "type": "web",
            }
        ],
        "evidence_grade": "relevant",
        "answer": "",
    }


def test_web_answer_uses_llm(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = (
        "Customer growth increased by 15%. "
        "[Source](https://example.com/report)"
    )
    monkeypatch.setattr(nodes, "llm", mock_llm)

    result = web_answer_node(
        make_state([
            "Title: Growth report\n"
            "URL: https://example.com/report\n"
            "Content: Customer growth increased by 15%."
        ])
    )

    assert "15%" in result["answer"]
    assert "https://example.com/report" in result["answer"]
    mock_llm.invoke.assert_called_once()

    prompt = mock_llm.invoke.call_args.args[0]

    assert "URL: https://example.com/report" in prompt
    assert "Customer growth increased by 15%." in prompt


def test_web_answer_handles_empty_context(monkeypatch):
    mock_llm = Mock()
    monkeypatch.setattr(nodes, "llm", mock_llm)

    result = web_answer_node(make_state([]))

    assert "couldn't find sufficient web evidence" in result["answer"]
    mock_llm.invoke.assert_not_called()


def test_web_answer_removes_unretrieved_citations(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = (
        "Growth increased by 15% according to "
        "[Growth Report](https://example.com/report). "
        "The market doubled according to "
        "[Fake Study](https://fake-example.com/study)."
    )
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state([
        "Title: Growth report\n"
        "URL: https://example.com/report\n"
        "Content: Customer growth increased by 15%."
    ])

    result = web_answer_node(state)
    answer = result["answer"]

    # The retrieved URL should remain clickable.
    assert (
        "[Growth Report](https://example.com/report)"
        in answer
    )

    # The unrecognized URL should be removed.
    assert "https://fake-example.com/study" not in answer
    assert "Fake Study" in answer



def test_web_answer_validates_citations(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = (
        "Growth increased by 15% according to "
        "[Growth Report](https://example.com/report). "
        "See also [Fake Study]"
        "(https://fake-example.com/study)."
    )
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state([
        "Title: Growth report\n"
        "URL: https://example.com/report\n"
        "Content: Customer growth increased by 15%."
    ])

    result = web_answer_node(state)
    answer = result["answer"]

    assert (
        "[Growth Report](https://example.com/report)"
        in answer
    )
    assert "https://fake-example.com/study" not in answer
    assert "Fake Study" in answer