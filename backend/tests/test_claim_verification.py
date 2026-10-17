import json
from unittest.mock import Mock

from app.graph.nodes.claim_verification import verify_claims_node
import app.graph.nodes.claim_verification as nodes

def make_state(answer, context):
    return {
        "question": "How much did customer growth increase?",
        "route": "retrieval",
        "context": context,
        "sources": [],
        "evidence_grade": "relevant",
        "answer": answer,
    }


def test_verify_supported_claim(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = json.dumps({
        "claims": [
            {
                "claim": "Customers increased from 20,000 to 23,000.",
                "status": "supported",
                "evidence": "The report states both customer counts.",
            }
        ]
    })
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state(
        "Customers increased from 20,000 to 23,000.",
        [
            "The report states customer counts of 20,000 in 2024 "
            "and 23,000 in 2025."
        ],
    )

    result = verify_claims_node(state)

    assert result["verification_results"][0]["status"] == "supported"
    mock_llm.invoke.assert_called_once()


def test_verify_contradicted_claim(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = json.dumps({
        "claims": [
            {
                "claim": "Customer growth was 25%.",
                "status": "contradicted",
                "evidence": "The reported figures imply 15% growth.",
            }
        ]
    })
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state(
        "Customer growth was 25%.",
        ["Customers increased from 20,000 to 23,000."],
    )

    result = verify_claims_node(state)

    assert (
        result["verification_results"][0]["status"]
        == "contradicted"
    )


def test_verify_not_supported_claim(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = json.dumps({
        "claims": [
            {
                "claim": "Revenue doubled.",
                "status": "not_supported",
                "evidence": "The evidence contains no revenue figures.",
            }
        ]
    })
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state(
        "Revenue doubled.",
        ["Customers increased from 20,000 to 23,000."],
    )

    result = verify_claims_node(state)

    assert (
        result["verification_results"][0]["status"]
        == "not_supported"
    )


def test_verify_handles_empty_answer():
    state = make_state("", ["Some retrieved evidence."])

    result = verify_claims_node(state)

    assert result["verification_results"] == []


def test_verify_handles_invalid_json(monkeypatch):
    mock_llm = Mock()
    mock_llm.invoke.return_value.content = "This is not valid JSON."
    monkeypatch.setattr(nodes, "llm", mock_llm)

    state = make_state(
        "Customer growth was 15%.",
        ["Customers increased from 20,000 to 23,000."],
    )

    result = verify_claims_node(state)

    assert result["verification_results"] == []