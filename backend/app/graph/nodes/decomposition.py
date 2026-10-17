from app.core.config import settings
from app.graph.state import EvidaState
from langchain_groq import ChatGroq
import json

llm = ChatGroq(
    model =  settings.groq_model,
    api_key = settings.groq_api_key,
    temperature=0
)

# Split a compound question into independently answerable questions.
def decompose_question_node(state: EvidaState) -> dict:
    question = state["question"]

    prompt = f"""
    You are a question decomposition assistant.

    Your task is to determine whether the user's question contains
    multiple independently answerable information requests.

    Rules:
    1. If the question contains only one information request,
    return the original question unchanged as a single subquestion.
    2. If the question contains multiple information requests,
    split it into the minimum number of clear, independently
    answerable subquestions needed to cover every part.
    3. Create as many subquestions as necessary (N). Do not limit
    the number to two.
    4. Preserve all important details, constraints, entities,
    time periods, and relationships from the original question.
    5. Each subquestion must be understandable on its own, without
    requiring the reader to refer to the original question.
    6. Do not omit, duplicate, or invent information requests.
    7. Return only valid JSON. Do not include Markdown or explanations.

    Required JSON format:
    {{
        "sub_questions": [
            "First subquestion",
            "Second subquestion"
        ]
    }}

    User question: {question}
    """

    response = llm.invoke(prompt)

    try:
        result = json.loads(response.content)
        sub_questions = result["sub_questions"]

        if not isinstance(sub_questions, list) or not sub_questions:
            raise ValueError("Invalid subquestions")

        sub_questions = [
            item.strip()
            for item in sub_questions
            if isinstance(item, str) and item.strip()
        ]

        if not sub_questions:
            sub_questions = [question]

    except (json.JSONDecodeError, KeyError, ValueError, TypeError):
        sub_questions = [question]

    return {"sub_questions": sub_questions}
