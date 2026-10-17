from app.graph.state import EvidaState
from app.core.config import settings
from langchain_groq import ChatGroq


llm = ChatGroq(
    model =  settings.groq_model,
    api_key = settings.groq_api_key,
    temperature=0
)

def rewrite_query_node(state: EvidaState) -> dict:
    # Rewrite the question to improve document retrieval.
    prompt = f"""
    You are improving a search query for Evida, an AI research assistant.

    The original question did not retrieve relevant document evidence.

    Rewrite the question as a concise, standalone search query that is
    more likely to retrieve useful passages from the document collection.

    Rules:
    - Preserve the user's original intent.
    - Keep important names, topics, and technical terms.
    - Use alternative keywords where helpful.
    - Do not answer the question.
    - Return only the rewritten search query.

    Original question:
    {state["question"]}

    Previous search query:
    {state.get("rewritten_query") or state["question"]}

    Rewritten search query:
    """

    response = llm.invoke(prompt)
    rewritten_query = response.content.strip()

    # Fall back to the original question if the model returns no query.
    if not rewritten_query:
        rewritten_query = state["question"]

    return {"rewritten_query": rewritten_query}
