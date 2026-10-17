from app.graph.state import EvidaState

def technical_error_node(state: EvidaState) -> dict:
    """Return a clear message when a tool fails technically."""
    return {
        "answer": (
            "I couldn't complete this part of the question "
            "because the web search encountered a technical issue. "
            "Please try this part again later."
        )
    }