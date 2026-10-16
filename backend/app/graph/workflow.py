from langgraph.graph import START, END, StateGraph

from app.graph.state import EvidaState
from app.graph.nodes import (
    router_node, 
    general_answer_node,
    retrieval_node,
    grade_evidence_node,
    rewrite_query_node,
    retrieval_answer_node,
    insufficient_evidence_node,
)

MAX_RETRIEVAL_ATTEMPTS = 2

def route_question(state: EvidaState) -> str:
    # Choose the next node based on the router's decision.
    return state["route"]

# Choose whether to answer, retry retrieval, or stop retrying.
def route_evidence(state: EvidaState) -> str:
    if state["evidence_grade"] == "relevant":
        return "relevant"
    
    if state.get("retrieval_attempts",0) < MAX_RETRIEVAL_ATTEMPTS:
        return "retry"
    
    return "exhausted"


builder = StateGraph(EvidaState)

# Nodes
builder.add_node("router", router_node)
builder.add_node("general_answer", general_answer_node)
builder.add_node("retrieval", retrieval_node)
builder.add_node("grade_evidence", grade_evidence_node)
builder.add_node("rewrite_query", rewrite_query_node)
builder.add_node("retrieval_answer", retrieval_answer_node)
builder.add_node("insufficient_evidence", insufficient_evidence_node)

# Edges
builder.add_edge(START, "router")

builder.add_conditional_edges(
    "router",
    route_question,
    {
        "general" : "general_answer",
        "retrieval" : "retrieval"
    }

)

builder.add_edge("retrieval", "grade_evidence")

builder.add_conditional_edges(
    "grade_evidence",
    route_evidence,
    {
        "relevant" : "retrieval_answer",
        "retry" : "rewrite_query",
        "exhausted": "insufficient_evidence",
    }
)

builder.add_edge("rewrite_query","retrieval")

builder.add_edge("general_answer", END)

builder.add_edge("retrieval_answer", END)

builder.add_edge("insufficient_evidence", END)


graph = builder.compile()