
from langgraph.graph import START, END, StateGraph

from app.graph.state import EvidaState

from app.graph.nodes.web_search import web_search_node
from app.graph.nodes.evidence_grading import web_evidence_grade_node
from app.graph.nodes.answer_generation import web_answer_node
from app.graph.nodes.insufficient_evidence import insufficient_evidence_node
from app.graph.nodes.query_rewriting import rewrite_query_node
from app.graph.nodes.retrieval import retrieval_node
from app.graph.nodes.evidence_grading import grade_evidence_node

MAX_RETRIEVAL_ATTEMPTS = 2


def route_document_evidence(state: EvidaState) -> str:
    if state["evidence_grade"] == "relevant":
        return "answer"

    if state.get("retrieval_attempts", 0) < MAX_RETRIEVAL_ATTEMPTS:
        return "retry"

    return "web_search"


def route_web_evidence(state: EvidaState) -> str:
    if state.get("evidence_grade") == "relevant":
        return "answer"

    return "insufficient"


def build_live_fallback_graph():
    builder = StateGraph(EvidaState)

    builder.add_node("retrieval", retrieval_node)
    builder.add_node("grade_evidence", grade_evidence_node)
    builder.add_node("rewrite_query", rewrite_query_node)
    builder.add_node("web_search", web_search_node)
    builder.add_node("web_evidence_grade", web_evidence_grade_node)
    builder.add_node("web_answer", web_answer_node)
    builder.add_node("insufficient_evidence", insufficient_evidence_node)

    builder.add_edge(START, "retrieval")
    builder.add_edge("retrieval", "grade_evidence")

    builder.add_conditional_edges(
        "grade_evidence",
        route_document_evidence,
        {
            "answer": END,
            "retry": "rewrite_query",
            "web_search": "web_search",
        },
    )

    builder.add_edge("rewrite_query", "retrieval")
    builder.add_edge("web_search", "web_evidence_grade")

    builder.add_conditional_edges(
        "web_evidence_grade",
        route_web_evidence,
        {
            "answer": "web_answer",
            "insufficient": "insufficient_evidence",
        },
    )

    builder.add_edge("web_answer", END)
    builder.add_edge("insufficient_evidence", END)

    return builder.compile()


def test_live_web_fallback():
    graph = build_live_fallback_graph()

    question = (
        "What were the major scientific discoveries announced "
        "in the 2026 Nobel Prize awards?"
    )

    result = graph.invoke({
        "question": question,
        "route": "retrieval",
        "context": [],
        "sources": [],
        "evidence_grade": None,
        "answer": "",
    })

    print("\nQuestion:", question)
    print("\nAnswer:", result["answer"])
    print("\nSources:", result.get("sources", []))
    print("Retrieval attempts:", result.get("retrieval_attempts", 0))

    assert result.get("retrieval_attempts", 0) == 2
    assert any(
        source.get("type") == "web"
        for source in result.get("sources", [])
    )
    assert result["answer"].strip()
