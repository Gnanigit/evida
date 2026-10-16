
from typing import Literal, TypedDict


class EvidaState(TypedDict):
    question: str
    route: Literal["general", "retrieval"]
    answer: str
    context: list[str]
    sources: list[dict]
