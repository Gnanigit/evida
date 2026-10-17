from langgraph.graph import START, END, StateGraph
from app.graph.state import EvidaState
from app.graph.nodes.router import router_node
from app.graph.nodes.decomposition import (
    decompose_question_node,
    prepare_subquestion_node,
    collect_subanswer_node,
    aggregate_subanswers_node,
)
from app.graph.nodes.retrieval import retrieval_node
from app.graph.nodes.evidence_grading import (
    grade_evidence_node,
    web_evidence_grade_node,
)
from app.graph.nodes.query_rewriting import rewrite_query_node
from app.graph.nodes.web_search import web_search_node
from app.graph.nodes.answer_generation import (
    general_answer_node,
    retrieval_answer_node,
    web_answer_node,
    finalize_verified_answer_node,
)
from app.graph.nodes.claim_verification import verify_claims_node
from app.graph.nodes.insufficient_evidence import insufficient_evidence_node
from app.graph.nodes.technical_error import technical_error_node

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
    
    return "web_search"

def route_web_evidence(state: EvidaState) -> str:
    if state.get("evidence_grade") == "relevant":
        return "relevant"

    return "irrelevant"

def route_after_web_search(state: EvidaState) -> str:
    if state.get("technical_error"):
        return "technical_error"

    return "success"

def route_next_subquestion(state: EvidaState) -> str:
    index = state.get("current_sub_question_index", 0)
    total = len(state.get("sub_questions") or [])

    if index < total:
        return "next"

    return "finish"

builder = StateGraph(EvidaState)

# Nodes
# Orchestration nodes
builder.add_node("decompose_question", decompose_question_node)
builder.add_node("prepare_subquestion", prepare_subquestion_node)
builder.add_node("collect_subanswer", collect_subanswer_node)
builder.add_node("aggregate_subanswers", aggregate_subanswers_node)

builder.add_node("router", router_node)
builder.add_node("general_answer", general_answer_node)
builder.add_node("retrieval", retrieval_node)
builder.add_node("grade_evidence", grade_evidence_node)
builder.add_node("rewrite_query", rewrite_query_node)
builder.add_node("retrieval_answer", retrieval_answer_node)
builder.add_node("web_search", web_search_node)
builder.add_node("web_evidence_grade", web_evidence_grade_node)
builder.add_node("web_answer", web_answer_node)
builder.add_node("verify_claims", verify_claims_node)
builder.add_node(
    "finalize_verified_answer",
    finalize_verified_answer_node,
)

builder.add_node("insufficient_evidence", insufficient_evidence_node)
builder.add_node("technical_error", technical_error_node)

# Edges
# Start by decomposing the original request.
builder.add_edge(START, "decompose_question")
builder.add_edge("decompose_question", "prepare_subquestion")
builder.add_edge("prepare_subquestion", "router")

# Route each subquestion through the existing pipeline.
builder.add_conditional_edges(
    "router",
    route_question,
    {
        "general": "general_answer",
        "retrieval": "retrieval",
        "web": "web_search",
    },
)


builder.add_edge("retrieval", "grade_evidence")

builder.add_conditional_edges(
    "grade_evidence",
    route_evidence,
    {
        "relevant" : "retrieval_answer",
        "retry" : "rewrite_query",
        "web_search": "web_search",
    }
)

builder.add_edge("rewrite_query","retrieval")

builder.add_conditional_edges(
    "web_search",
    route_after_web_search,
    {
        "technical_error": "technical_error",
        "success": "web_evidence_grade",
    },
)

builder.add_edge("technical_error", "collect_subanswer")

builder.add_conditional_edges(
    "web_evidence_grade",
    route_web_evidence,
    {
        "relevant" : "web_answer",
        "irrelevant" : "insufficient_evidence"
    }
)


# Finish the selected answer path, then collect its result.
builder.add_edge("general_answer", "collect_subanswer")
builder.add_edge("retrieval_answer", "collect_subanswer")
builder.add_edge("finalize_verified_answer", "collect_subanswer")
builder.add_edge("insufficient_evidence", "collect_subanswer")

builder.add_edge("web_answer", "verify_claims")

builder.add_edge("verify_claims", "finalize_verified_answer")

# Continue with the next subquestion or finish the workflow.
builder.add_conditional_edges(
    "collect_subanswer",
    route_next_subquestion,
    {
        "next": "prepare_subquestion",
        "finish": "aggregate_subanswers",
    },
)

builder.add_edge("aggregate_subanswers", END)

# builder.add_edge("general_answer", END)

# builder.add_edge("retrieval_answer", END)

# builder.add_edge("finalize_verified_answer", END)

# builder.add_edge("insufficient_evidence", END)


graph = builder.compile()