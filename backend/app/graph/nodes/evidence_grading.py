from app.graph.state import EvidaState
from app.core.config import settings
from langchain_groq import ChatGroq


llm = ChatGroq(
    model =  settings.groq_model,
    api_key = settings.groq_api_key,
    temperature=0
)

def grade_evidence_node(state: EvidaState) -> dict:
    # Evaluate whether retrieved document chunks are relevant.
    context = "\n\n".join(state.get("context",[]))

    if not context.strip():
        return {"evidence_grade": "irrelevant"}

    prompt = f"""
    You are evaluating evidence for Evida, An AI research assistant.

    Determine whether the provided document evidence is relevant to answer the user's question.

    Return exactly one word:
    relevant
    irrelevant

    Question: {state["question"]}

    Document Evidence: {context}
    """
    response = llm.invoke(prompt)
    grade = response.content.strip().lower()

    if grade not in ("relevant", "irrelevant"):
        grade = "irrelevant"

    return {"evidence_grade": grade}




# Evaluate whether web results sufficiently answer the question.
def web_evidence_grade_node(state: EvidaState) -> dict:
    context = "\n\n".join(state.get("context",[]))

    if not context.strip():
        return {"evidence_grade": "irrelevant"}

    prompt = f"""
    You are evaluating web evidence for Evida, an AI research assistant.

    Determine whether the web evidence is both relevant and sufficient
    to answer the user's original question.

    Return exactly one word:
    relevant
    irrelevant

    Mark evidence as relevant only when it:
    - Directly addresses the question.
    - Contains enough specific information to support an answer.
    - Does not require inventing missing facts.

    If the question has multiple parts, the evidence should cover
    the important parts of the question.

    Question:
    {state["question"]}

    Web evidence:
    {context}
    """

    response = llm.invoke(prompt)

    grade = response.content.strip().lower()

    if grade not in ("relevant", "irrelevant"):
        grade = "irrelevant"

    return {"evidence_grade": grade}

