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

    original_question = question

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

        print("Original question:", repr(question))
        print("LLM response:", repr(response.content))

        if not isinstance(result, dict):
            raise ValueError("Expected a JSON object")

        sub_questions = result.get("sub_questions")

        if not isinstance(sub_questions, list) or not sub_questions:
            raise ValueError("Invalid subquestions")

        if not all(
            isinstance(item, str) and item.strip()
            for item in sub_questions
        ):
            raise ValueError("Subquestions must be non-empty strings")

        sub_questions = [item.strip() for item in sub_questions]

    except (json.JSONDecodeError, KeyError, ValueError, TypeError):
        sub_questions = [question]

    return {
        "original_question": original_question,
        "sub_questions": sub_questions,
    }



def prepare_subquestion_node(state: EvidaState) -> dict:
    """Select a subquestion and clear state from the previous iteration."""
    original_question = state.get(
        "original_question",
        state["question"],
    )
    sub_questions = state.get("sub_questions") or [original_question]
    index = state.get("current_sub_question_index", 0)
    current_question = sub_questions[index]

    return {
        "original_question": original_question,
        "current_question": current_question,
        "current_sub_question_index": index,
        "question": current_question,
        "context": [],
        "sources": [],
        "evidence_grade": None,
        "rewritten_query": "",
        "retrieval_attempts": 0,
        "answer": "",
        "verification_results": [],
        "verified_answer": "",
        "technical_error": None,
    }



def collect_subanswer_node(state: EvidaState) -> dict:
    """Save one answer, its route, and its sources."""
    sub_answers = list(state.get("sub_answers", []))

    sub_answers.append(
        {
            "question": state.get(
                "current_question",
                state["question"],
            ),
            "route": state.get("route"),
            "answer": state.get("verified_answer")
            or state.get("answer", ""),
            "sources": list(state.get("sources", [])),
        }
    )

    return {
        "sub_answers": sub_answers,
        "current_sub_question_index": (
            state.get("current_sub_question_index", 0) + 1
        ),
    }



def aggregate_subanswers_node(state: EvidaState) -> dict:
    """Combine answers and collect unique sources from all subquestions."""
    sections = []
    combined_sources = []
    seen_sources = set()

    for index, item in enumerate(state.get("sub_answers", []), start=1):
        section = [
            f"### {index}. {item['question']}",
            item.get("answer", ""),
        ]

        source_lines = []

        for source in item.get("sources", []):
            source_key = (
                source.get("url"),
                source.get("document_id"),
                source.get("source"),
                source.get("page"),
            )

            if source_key not in seen_sources:
                seen_sources.add(source_key)
                combined_sources.append(source)

                url = source.get("url")
                title = (
                    source.get("title")
                    or source.get("source")
                    or url
                    or "Source"
                )

                if url:
                    source_lines.append(f"- [{title}]({url})")
                else:
                    page = source.get("page")
                    label = str(title)
                    if page is not None:
                        label += f" (page {page})"
                    source_lines.append(f"- {label}")

        if source_lines:
            section.extend(["", "**Sources**", *source_lines])

        sections.append("\n".join(section))

    return {
        "answer": "\n\n".join(sections),
        "sources": combined_sources,
    }