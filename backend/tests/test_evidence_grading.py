
from langgraph.graph import START, END, StateGraph

from app.graph.state import EvidaState


def build_test_graph(
    router,
    retrieval,
    grader,
    answer,
    fallback,
):
    """Build an isolated graph using the supplied test nodes."""

    builder = StateGraph(EvidaState)

    builder.add_node("router", router)

    builder.add_node(
        "general_answer",
        lambda state: {"answer": "General answer"},
    )

    builder.add_node("retrieval", retrieval)
    builder.add_node("grade_evidence", grader)
    builder.add_node("retrieval_answer", answer)
    builder.add_node("insufficient_evidence", fallback)

    builder.add_edge(START, "router")

    builder.add_conditional_edges(
        "router",
        lambda state: state["route"],
        {
            "general": "general_answer",
            "retrieval": "retrieval",
        },
    )

    builder.add_edge("retrieval", "grade_evidence")

    builder.add_conditional_edges(
        "grade_evidence",
        lambda state: state["evidence_grade"],
        {
            "relevant": "retrieval_answer",
            "irrelevant": "insufficient_evidence",
        },
    )

    builder.add_edge("general_answer", END)
    builder.add_edge("retrieval_answer", END)
    builder.add_edge("insufficient_evidence", END)

    return builder.compile()


def test_relevant_evidence_routes_to_answer_generation():
    """Relevant evidence should lead to answer generation."""

    def fake_router(state):
        return {"route": "retrieval"}

    def fake_retrieval(state):
        return {
            "context": [
                "Evida is an AI research assistant powered by Agentic RAG."
            ],
            "sources": [
                {"source": "evida_notes.pdf", "page": 1}
            ],
        }

    def fake_grader(state):
        return {"evidence_grade": "relevant"}

    def fake_answer(state):
        assert state["evidence_grade"] == "relevant"
        assert len(state["context"]) > 0

        return {
            "answer": (
                "Evida is an AI research assistant powered by Agentic RAG."
            )
        }

    def fake_fallback(state):
        return {"answer": "Insufficient evidence."}

    test_graph = build_test_graph(
        router=fake_router,
        retrieval=fake_retrieval,
        grader=fake_grader,
        answer=fake_answer,
        fallback=fake_fallback,
    )

    result = test_graph.invoke(
        {"question": "What is Evida?"}
    )

    assert result["route"] == "retrieval"
    assert result["evidence_grade"] == "relevant"
    assert "AI research assistant" in result["answer"]


def test_irrelevant_evidence_routes_to_fallback():
    """Irrelevant evidence should not reach answer generation."""

    def fake_router(state):
        return {"route": "retrieval"}

    def fake_retrieval(state):
        return {
            "context": ["The weather is sunny today."],
            "sources": [
                {"source": "unrelated.pdf", "page": 1}
            ],
        }

    def fake_grader(state):
        return {"evidence_grade": "irrelevant"}

    def unexpected_answer(state):
        raise AssertionError(
            "Answer generation should not run for irrelevant evidence."
        )

    def fake_fallback(state):
        return {
            "answer": (
                "I couldn't find sufficiently relevant information "
                "in the available documents to answer this question."
            )
        }

    test_graph = build_test_graph(
        router=fake_router,
        retrieval=fake_retrieval,
        grader=fake_grader,
        answer=unexpected_answer,
        fallback=fake_fallback,
    )

    result = test_graph.invoke(
        {"question": "What is Evida?"}
    )

    assert result["route"] == "retrieval"
    assert result["evidence_grade"] == "irrelevant"
    assert "couldn't find sufficiently relevant information" in (
        result["answer"].lower()
    )
