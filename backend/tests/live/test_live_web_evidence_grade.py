
import pytest

from app.graph.nodes.evidence_grading import web_evidence_grade_node

@pytest.mark.parametrize(
    ("question", "context", "expected_grade"),
    [
        # Case 1: Evidence is relevant and sufficient.
        (
            "What caused customer growth?",
            [
                "Title: Annual Growth Report\n"
                "Content: Customer growth increased by 15% during "
                "2025, driven by improved customer retention."
            ],
            "relevant",
        ),

        # Case 2: Evidence is relevant but insufficient.
        (
            "What caused customer growth?",
            [
                "Title: Annual Growth Report\n"
                "Content: Customer growth increased by 15% during 2025. "
                "The report does not explain the reason for the increase."
            ],
            "irrelevant",
        ),

        # Case 3: Evidence is explicitly speculative.
        (
            "Who won the scientific award?",
            [
                "Title: Award Predictions Blog\n"
                "Content: The author predicts that Researcher X may win "
                "the award. The official announcement has not been made, "
                "and no winner has been confirmed."
            ],
            "irrelevant",
        ),
    ],
    ids=[
        "sufficient-evidence",
        "relevant-but-insufficient-evidence",
        "speculative-evidence",
    ],
)
def test_live_web_evidence_grade(question, context, expected_grade):
    result = web_evidence_grade_node(
        {
            "question": question,
            "route": "retrieval",
            "context": context,
            "sources": [],
            "evidence_grade": None,
            "answer": "",
        }
    )

    actual_grade = result["evidence_grade"]

    print(f"\nQuestion: {question}")
    print(f"Expected grade: {expected_grade}")
    print(f"Actual grade: {actual_grade}")

    assert actual_grade == expected_grade
