
from langgraph.graph import START, END, StateGraph

from app.graph.state import EvidaState
from app.graph.workflow import MAX_RETRIEVAL_ATTEMPTS


def build_test_graph(retrieval, grader, rewriter, web_search,
                     web_grader, retrieval_answer, web_answer, fallback):
    builder = StateGraph(EvidaState)

    builder.add_node("router", lambda state: {"route": "retrieval"})
    builder.add_node("general_answer", lambda state: {"answer": "General answer"})
    builder.add_node("retrieval", retrieval)
    builder.add_node("grade_evidence", grader)
    builder.add_node("rewrite_query", rewriter)
    builder.add_node("retrieval_answer", retrieval_answer)
    builder.add_node("web_search", web_search)
    builder.add_node("web_evidence_grade", web_grader)
    builder.add_node("web_answer", web_answer)
    builder.add_node("insufficient_evidence", fallback)

    builder.add_edge(START, "router")
    builder.add_conditional_edges(
        "router",
        lambda state: state["route"],
        {"general": "general_answer", "retrieval": "retrieval"},
    )
    builder.add_edge("retrieval", "grade_evidence")

    def route_document_evidence(state):
        if state["evidence_grade"] == "relevant":
            return "relevant"
        if state.get("retrieval_attempts", 0) < MAX_RETRIEVAL_ATTEMPTS:
            return "retry"
        return "web_search"

    builder.add_conditional_edges(
        "grade_evidence",
        route_document_evidence,
        {
            "relevant": "retrieval_answer",
            "retry": "rewrite_query",
            "web_search": "web_search",
        },
    )

    builder.add_edge("rewrite_query", "retrieval")
    builder.add_edge("web_search", "web_evidence_grade")
    builder.add_conditional_edges(
        "web_evidence_grade",
        lambda state: (
            "relevant"
            if state.get("evidence_grade") == "relevant"
            else "irrelevant"
        ),
        {
            "relevant": "web_answer",
            "irrelevant": "insufficient_evidence",
        },
    )

    for node in (
        "general_answer",
        "retrieval_answer",
        "web_answer",
        "insufficient_evidence",
    ):
        builder.add_edge(node, END)

    return builder.compile()


def initial_state():
    return {
        "question": "What does the report say about customer growth?",
        "route": "retrieval",
        "context": [],
        "sources": [],
        "evidence_grade": None,
        "answer": "",
    }


def test_document_retry_succeeds_without_web_search():
    retrieval_calls = []
    web_calls = []

    def retrieval(state):
        attempt = state.get("retrieval_attempts", 0) + 1
        retrieval_calls.append(attempt)
        return {"retrieval_attempts": attempt, "context": [f"Document {attempt}"]}

    def grader(state):
        grade = "irrelevant" if state["retrieval_attempts"] == 1 else "relevant"
        return {"evidence_grade": grade}

    def rewriter(state):
        return {"rewritten_query": "customer growth trends"}

    def web_search(state):
        web_calls.append(True)
        return {"context": ["Web evidence"], "sources": []}

    def web_grader(state):
        return {"evidence_grade": "relevant"}

    graph = build_test_graph(
        retrieval,
        grader,
        rewriter,
        web_search,
        web_grader,
        lambda state: {"answer": "Document-grounded answer"},
        lambda state: {"answer": "Web-grounded answer"},
        lambda state: {"answer": "Insufficient evidence"},
    )

    result = graph.invoke(initial_state())

    assert retrieval_calls == [1, 2]
    assert web_calls == []
    assert result["answer"] == "Document-grounded answer"


def test_web_fallback_succeeds_after_document_retries():
    retrieval_calls = []
    web_calls = []

    def retrieval(state):
        attempt = state.get("retrieval_attempts", 0) + 1
        retrieval_calls.append(attempt)
        return {"retrieval_attempts": attempt, "context": []}

    def grader(state):
        return {"evidence_grade": "irrelevant"}

    def rewriter(state):
        return {"rewritten_query": "improved customer growth query"}

    def web_search(state):
        web_calls.append(True)
        return {"context": ["Relevant web evidence"], "sources": []}

    def web_grader(state):
        return {"evidence_grade": "relevant"}

    graph = build_test_graph(
        retrieval,
        grader,
        rewriter,
        web_search,
        web_grader,
        lambda state: {"answer": "Document-grounded answer"},
        lambda state: {"answer": "Web-grounded answer"},
        lambda state: {"answer": "Insufficient evidence"},
    )

    result = graph.invoke(initial_state())

    assert retrieval_calls == [1, 2]
    assert len(web_calls) == 1
    assert result["answer"] == "Web-grounded answer"


def test_insufficient_web_evidence_returns_fallback():
    retrieval_calls = []
    web_calls = []

    def retrieval(state):
        attempt = state.get("retrieval_attempts", 0) + 1
        retrieval_calls.append(attempt)
        return {"retrieval_attempts": attempt, "context": []}

    def grader(state):
        return {"evidence_grade": "irrelevant"}

    def rewriter(state):
        return {"rewritten_query": "improved query"}

    def web_search(state):
        web_calls.append(True)
        return {"context": ["Unrelated web evidence"], "sources": []}

    def web_grader(state):
        return {"evidence_grade": "irrelevant"}

    graph = build_test_graph(
        retrieval,
        grader,
        rewriter,
        web_search,
        web_grader,
        lambda state: {"answer": "Document-grounded answer"},
        lambda state: {"answer": "Should not answer"},
        lambda state: {"answer": "Insufficient evidence"},
    )

    result = graph.invoke(initial_state())

    assert retrieval_calls == [1, 2]
    assert len(web_calls) == 1
    assert result["answer"] == "Insufficient evidence"
