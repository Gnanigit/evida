from app.graph.nodes.answer_generation import finalize_verified_answer_node
from app.graph.nodes.claim_verification import verify_claims_node


def test_live_claim_verification():
    state = {
        "question": "How much did customer growth increase?",
        "route": "retrieval",
        "context": [
            "The report states customer counts of 20,000 in 2024 "
            "and 23,000 in 2025."
        ],
        "sources": [
            {
                "source": "Growth Report",
                "url": "https://example.com/report",
                "type": "web",
            }
        ],
        "evidence_grade": "relevant",
        "answer": (
            "Customer growth increased from 20,000 to 23,000, "
            "a growth rate of 15%. Revenue doubled."
        ),
    }

    verification = verify_claims_node(state)
    state.update(verification)

    assert state["verification_results"], (
        "The verifier returned no claim results."
    )

    statuses = {
        item["status"]
        for item in state["verification_results"]
    }

    assert "supported" in statuses
    assert "not_supported" in statuses

    final_result = finalize_verified_answer_node(state)

    assert final_result["answer"].strip(), (
        "The final answer should not be empty."
    )

    print("\nVerification results:")
    for item in state["verification_results"]:
        print(f"- {item['status']}: {item['claim']}")

    print("\nFinal answer:")
    print(final_result["answer"])