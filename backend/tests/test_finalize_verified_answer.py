from unittest.mock import Mock

import app.graph.nodes.answer_generation as nodes
from app.graph.nodes.answer_generation import finalize_verified_answer_node


def make_state(verification_results, answer="Original generated answer."):
    return {
        "question": "How much did customer growth increase?",
        "route": "retrieval",
        "context": [
            "Customers increased from 20,000 in 2024 to "
            "23,000 in 2025."
        ],
        "sources": [
            {
                "source": "Growth Report",
                "url": "https://example.com/report",
                "type": "web",
            }
        ],
        "evidence_grade": "relevant",
        "answer": answer,
        "verification_results": verification_results,
    }


def test_finalizer_includes_supported_claims(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = (
        "Customer growth was 15%. "
        "[Growth Report](https://example.com/report)"
    )
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state([
        {
            "claim": "Customer growth was 15%.",
            "status": "supported",
            "evidence": "The increase from 20,000 to 23,000 is 15%.",
        }
    ])

    result = finalize_verified_answer_node(state)

    assert "15%" in result["answer"]
    assert result["verified_answer"] == result["answer"]
    mock_llm.invoke.assert_called_once()


def test_finalizer_does_not_pass_unsupported_claims_as_supported(
    monkeypatch,
):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = (
        "Customer growth was 15%."
    )
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state([
        {
            "claim": "Customer growth was 15%.",
            "status": "supported",
            "evidence": "The reported counts imply 15% growth.",
        },
        {
            "claim": "Revenue doubled.",
            "status": "not_supported",
            "evidence": "No revenue figures were found.",
        },
        {
            "claim": "Customer growth was 25%.",
            "status": "contradicted",
            "evidence": "The reported counts imply 15% growth.",
        },
    ])

    finalize_verified_answer_node(state)

    prompt = mock_llm.invoke.call_args.args[0]

    assert "Customer growth was 15%." in prompt
    assert "Revenue doubled." not in prompt
    assert "Customer growth was 25%." not in prompt


def test_finalizer_handles_empty_verification_results():
    state = make_state([])

    result = finalize_verified_answer_node(state)

    assert "couldn't verify" in result["answer"].lower()
    assert result["verified_answer"] == result["answer"]


def test_finalizer_handles_no_supported_claims():
    state = make_state([
        {
            "claim": "Revenue doubled.",
            "status": "not_supported",
            "evidence": "No revenue figures were found.",
        },
        {
            "claim": "Customer growth was 25%.",
            "status": "contradicted",
            "evidence": "The reported counts imply 15% growth.",
        },
    ])

    result = finalize_verified_answer_node(state)

    assert "did not establish" in result["answer"].lower()
    assert result["verified_answer"] == result["answer"]


def test_finalizer_removes_unretrieved_citations(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = (
        "Customer growth was 15%. "
        "[Growth Report](https://example.com/report). "
        "[Fake Study](https://fake-example.com/study)."
    )
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state([
        {
            "claim": "Customer growth was 15%.",
            "status": "supported",
            "evidence": "The reported counts imply 15% growth.",
        }
    ])

    result = finalize_verified_answer_node(state)

    assert "[Growth Report](https://example.com/report)" in result["answer"]
    assert "https://fake-example.com/study" not in result["answer"]
    assert "Fake Study" in result["answer"]