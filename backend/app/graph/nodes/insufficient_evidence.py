from app.graph.state import EvidaState
# insufficient evidence
def insufficient_evidence_node(state: EvidaState) -> dict:
    """Explain when available evidence cannot answer the question."""
    return {
        "answer": (
            "I couldn't find sufficiently relevant and complete "
            "evidence in the available sources to answer this "
            "question reliably."
        )
    }

