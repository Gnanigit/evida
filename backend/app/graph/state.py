
from typing import Literal, TypedDict, NotRequired


class EvidaState(TypedDict):
    # The user's original question
    question: str

    # The workflow's routing decision
    route: Literal["general", "retrieval"]

    # Retrieved document information
    context: list[str]
    sources: list[dict]

    # Evidence evaluation
    evidence_grade: Literal["relevant", "irrelevant"] | None

    # Query rewriting and retry tracking
    rewritten_query: NotRequired[str]
    retrieval_attempts: NotRequired[int]

    # Compound-question support
    sub_questions: NotRequired[list[str]]
    sub_answers: NotRequired[list[dict]]

    # Final response
    answer: str

    # Claim verification
    verification_results: NotRequired[list[dict]]
    verified_answer: NotRequired[str]
