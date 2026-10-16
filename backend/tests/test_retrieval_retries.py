from langgraph.graph import START, END, StateGraph

from app.graph.state import EvidaState
from app.graph.workflow import MAX_RETRIEVAL_ATTEMPTS

def build_retry_test_graph(retrieval, grader, rewriter, answer, fallback):
    builder = StateGraph(EvidaState)
    

    builder.add_node("retrieval", retrieval)
    builder.add_node("grade_evidence", grader)
    builder.add_node("rewrite_query", rewriter)
    builder.add_node("retrieval_answer", answer)
    builder.add_node("insufficient_evidence", fallback)

    builder.add_edge(START, "retrieval")
    builder.add_edge("retrieval", "grade_evidence")

    def route_evidence(state):
        if state["evidence_grade"] == "relevant":
            return "relevant"
        if state.get("retrieval_attempts", 0) < MAX_RETRIEVAL_ATTEMPTS:
            return "retry"
        return "exhausted"

    builder.add_conditional_edges(
        "grade_evidence",
        route_evidence,
        {
            "relevant": "retrieval_answer",
            "retry": "rewrite_query",
            "exhausted": "insufficient_evidence",
        },
    )

    builder.add_edge("rewrite_query", "retrieval")
    builder.add_edge("retrieval_answer", END)
    builder.add_edge("insufficient_evidence", END)

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


def test_retries_and_answers_when_second_grade_is_relevant():
    retrieval_calls = []
    grade_calls = []

    def retrieval(state):
        attempt = state.get("retrieval_attempts", 0) + 1
        retrieval_calls.append(attempt)
        return {"retrieval_attempts": attempt, "context": [f"Evidence {attempt}"]}

    def grader(state):
        grade_calls.append(state["retrieval_attempts"])
        grade = "irrelevant" if state["retrieval_attempts"] == 1 else "relevant"
        return {"evidence_grade": grade}

    def rewriter(state):
        return {"rewritten_query": "customer growth trends"}

    def answer(state):
        return {"answer": "Customer growth answer"}

    def fallback(state):
        return {"answer": "Insufficient evidence"}

    graph = build_retry_test_graph(
        retrieval, grader, rewriter, answer, fallback
    )
    result = graph.invoke(initial_state())

    assert retrieval_calls == [1, 2]
    assert grade_calls == [1, 2]
    assert result["answer"] == "Customer growth answer"



def test_stops_after_maximum_retrieval_attempts():
    retrieval_calls = []

    def retrieval(state):
        attempt = state.get("retrieval_attempts", 0) + 1
        retrieval_calls.append(attempt)
        return {"retrieval_attempts": attempt, "context": []}

    def grader(state):
        return {"evidence_grade": "irrelevant"}

    def rewriter(state):
        return {"rewritten_query": "improved query"}

    def answer(state):
        return {"answer": "Should not be called"}

    def fallback(state):
        return {"answer": "Insufficient evidence"}

    graph = build_retry_test_graph(
        retrieval, grader, rewriter, answer, fallback
    )
    result = graph.invoke(initial_state())

    assert retrieval_calls == [1, 2]
    assert len(retrieval_calls) == MAX_RETRIEVAL_ATTEMPTS
    assert result["answer"] == "Insufficient evidence"