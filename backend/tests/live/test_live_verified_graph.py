from langgraph.graph import START, END, StateGraph

from app.graph.state import EvidaState

from app.graph.nodes.web_search import web_search_node
from app.graph.nodes.evidence_grading import web_evidence_grade_node
from app.graph.nodes.claim_verification import verify_claims_node
from app.graph.nodes.answer_generation import (
    web_answer_node,
    finalize_verified_answer_node)


def route_web_evidence(state: EvidaState) -> str:
    if state.get("evidence_grade") == "relevant":
        return "answer"

    return "insufficient"


def insufficient_evidence(state: EvidaState) -> dict:
    return {
        "answer": (
            "I couldn't find sufficiently relevant evidence "
            "to answer this question reliably."
        )
    }


def build_test_graph():
    builder = StateGraph(EvidaState)

    builder.add_node("web_search", web_search_node)
    builder.add_node("grade", web_evidence_grade_node)
    builder.add_node("answer", web_answer_node)
    builder.add_node("verify", verify_claims_node)
    builder.add_node("finalize", finalize_verified_answer_node)
    builder.add_node("insufficient", insufficient_evidence)

    builder.add_edge(START, "web_search")
    builder.add_edge("web_search", "grade")

    builder.add_conditional_edges(
        "grade",
        route_web_evidence,
        {
            "answer": "answer",
            "insufficient": "insufficient",
        },
    )

    builder.add_edge("answer", "verify")
    builder.add_edge("verify", "finalize")
    builder.add_edge("finalize", END)
    builder.add_edge("insufficient", END)

    return builder.compile()


def test_live_graph_runs_claim_verification():
    test_graph = build_test_graph()

    result = test_graph.invoke({
        "question": (
            "What are the latest developments in NASA's Artemis program?"
        ),
        "route": "retrieval",
        "context": [],
        "sources": [],
        "evidence_grade": None,
        "answer": "",
    })

    print("\nEvidence grade:", result.get("evidence_grade"))
    print("Verification results:", result.get("verification_results"))
    print("\nFinal answer:\n", result.get("answer"))

    assert result.get("answer", "").strip(), (
        "The graph should return a non-empty answer."
    )

    if result.get("evidence_grade") == "relevant":
        assert result.get("verification_results"), (
            "Relevant web evidence should lead to claim verification."
        )
        assert result.get("verified_answer", "").strip(), (
            "The finalizer should produce a verified answer."
        )