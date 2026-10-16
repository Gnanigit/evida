from langgraph.graph import START, END, StateGraph

from app.graph.state import EvidaState
from app.graph.nodes import (
    router_node, 
    general_answer_node,
    retrieval_node,
    retrieval_answer_node
)

def route_question(state: EvidaState) -> str:
    # Choose the next node based on the router's decision.
    return state["route"]

builder = StateGraph(EvidaState)

# Nodes
builder.add_node("router", router_node)
builder.add_node("general_answer", general_answer_node)
builder.add_node("retrieval", retrieval_node)
builder.add_node("retrieval_answer", retrieval_answer_node)

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
builder.add_edge("retrieval", "retrieval_answer")

builder.add_edge("general_answer", END)

builder.add_edge("retrieval_answer", END)

graph = builder.compile()