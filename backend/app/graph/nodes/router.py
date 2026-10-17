from app.core.config import settings
from app.graph.state import EvidaState
from langchain_groq import ChatGroq


llm = ChatGroq(
    model =  settings.groq_model,
    api_key = settings.groq_api_key,
    temperature=0
)

def router_node(state: EvidaState) -> dict:
    prompt = f"""
    Classify the user's question into exactly one category:

    - general: Stable facts, explanations, or concepts that can be
      answered using general knowledge.
    - retrieval: Questions about uploaded documents or information
      that should be answered from the document collection.
    - web: Questions about recent events, current information, or
      external facts that require web research.

    Return only one word: general, retrieval, or web.

    Question: {state["question"]}
    """

    response = llm.invoke(prompt)
    decision = response.content.strip().lower()

    if decision not in ("general", "retrieval", "web"):
        decision = "general"

    return {"route": decision}