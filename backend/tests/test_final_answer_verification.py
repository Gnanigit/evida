
import json
from unittest.mock import Mock

import app.graph.nodes.claim_verification as nodes


def test_final_answer_with_unsupported_claim_fails_closed(monkeypatch):
    # Evidence supports only the 15% customer growth claim.
    state = {
        "question": "How did customer growth change?",
        "route": "retrieval",
        "context": [
            "Customer growth increased by 15% during the reporting period."
        ],
        "sources": [],
        "evidence_grade": "relevant",
        "answer": "Customer growth increased by 15%.",
    }

    # Simulate a final answer that introduces an unsupported claim.
    unsafe_final_answer = (
        "Customer growth increased by 15%. "
        "The company doubled its profits."
    )

    verification_response = {
        "claims": [
            {
                "claim": "Customer growth increased by 15%.",
                "status": "supported",
                "evidence": "The evidence explicitly states 15% growth.",
            },
            {
                "claim": "The company doubled its profits.",
                "status": "not_supported",
                "evidence": "The evidence says nothing about profits.",
            },
        ]
    }

    fake_llm = Mock()
    fake_llm.invoke.return_value = Mock(
        content=json.dumps(verification_response)
    )
    monkeypatch.setattr(nodes, "llm", fake_llm)

    # Act: run the existing claim verifier against the final answer.
    state["answer"] = unsafe_final_answer
    result = nodes.verify_claims_node(state)

    # Assert: the verification detects the unsupported statement.
    statuses = {
        item["claim"]: item["status"]
        for item in result["verification_results"]
    }

    assert statuses["Customer growth increased by 15%."] == "supported"
    assert statuses["The company doubled its profits."] == "not_supported"

