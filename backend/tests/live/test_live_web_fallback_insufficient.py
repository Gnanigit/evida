
from langgraph.graph import START, END, StateGraph

from app.graph.state import EvidaState
from app.graph.nodes import (
    web_search_node,
    web_evidence_grade_node,
    web_answer_node,
    insufficient_evidence_node,
)


def build_live_web_evidence_graph():
    builder = StateGraph(EvidaState)

    builder.add_node("web_search", web_search_node)
    builder.add_node("web_evidence_grade", web_evidence_grade_node)
    builder.add_node("web_answer", web_answer_node)
    builder.add_node("insufficient_evidence", insufficient_evidence_node)

    builder.add_edge(START, "web_search")
    builder.add_edge("web_search", "web_evidence_grade")

    def route_web_evidence(state):
        if state.get("evidence_grade") == "relevant":
            return "relevant"
        return "insufficient"

    builder.add_conditional_edges(
        "web_evidence_grade",
        route_web_evidence,
        {
            "relevant": "web_answer",
            "insufficient": "insufficient_evidence",
        },
    )

    builder.add_edge("web_answer", END)
    builder.add_edge("insufficient_evidence", END)

    return builder.compile()


def test_live_web_search_rejects_insufficient_evidence():
    graph = build_live_web_evidence_graph()

    question = (
        "What were the three officially confirmed causes of the "
        "fictional Zorvanta deep-space probe failure announced by "
        "the International Orbital Safety Commission?"
    )

    result = graph.invoke(
        {
            "question": question,
            "route": "retrieval",
            "context": [],
            "sources": [],
            "evidence_grade": None,
            "answer": "",
        }
    )

    print(f"\nQuestion: {question}")
    print(f"Evidence grade: {result['evidence_grade']}")
    print(f"Sources found: {len(result.get('sources', []))}")
    print(f"Answer: {result['answer']}")

    assert result["evidence_grade"] == "irrelevant"
    assert result["answer"].strip()
    assert (
        "couldn't find sufficiently relevant and complete evidence"
        in result["answer"].lower()
    )
