
import json
from unittest.mock import Mock

from app.graph import nodes


def test_verified_pipeline_excludes_unsupported_claims(monkeypatch):
    # Arrange: fixed evidence and a generated answer containing
    # one supported claim and one unsupported claim.
    evidence = (
        "The report states that customer growth increased by 15% "
        "during the reporting period."
    )

    generated_answer = (
        "Customer growth increased by 15%. "
        "The company doubled its profits."
    )

    verification_response = {
        "claims": [
            {
                "claim": "Customer growth increased by 15%.",
                "status": "supported",
                "evidence": "The evidence explicitly reports 15% growth.",
            },
            {
                "claim": "The company doubled its profits.",
                "status": "not_supported",
                "evidence": "The evidence contains no profit information.",
            },
        ]
    }

    # Mock the LLM responses so this test is repeatable.
    fake_llm = Mock()
    fake_llm.invoke.return_value = Mock(
        content=json.dumps(verification_response)
    )
    monkeypatch.setattr(nodes, "llm", fake_llm)

    state = {
        "question": "How did customer growth and profits change?",
        "route": "retrieval",
        "context": [evidence],
        "sources": [],
        "evidence_grade": "relevant",
        "answer": generated_answer,
    }

    # Act: run the actual claim-verification node.
    verification_update = nodes.verify_claims_node(state)
    state.update(verification_update)

    # Confirm the verifier distinguishes supported from unsupported.
    results = state["verification_results"]
    assert results[0]["status"] == "supported"
    assert results[1]["status"] == "not_supported"

    
    # The finalizer must receive only supported claims.
    nodes.finalize_verified_answer_node(state)

    finalizer_prompt = fake_llm.invoke.call_args.args[0]

    # Isolate the supported-claims section of the prompt.
    supported_section = finalizer_prompt.split(
        "Supported claims:", 1
    )[1].split(
        "Retrieved web evidence:", 1
    )[0]

    assert "Customer growth increased by 15%." in supported_section
    assert "The company doubled its profits." not in supported_section

