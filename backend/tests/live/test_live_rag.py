
from app.graph.workflow import graph


def test_live_document_retrieval():
    question = "How much did registered customers grow in 2025?"

    result = graph.invoke({
        "question": question,
        "route": "retrieval",
        "context": [],
        "sources": [],
        "evidence_grade": None,
        "answer": "",
    })

    print("\nAnswer:", result["answer"])
    print("Sources:", result.get("sources", []))
    print("Retrieval attempts:", result.get("retrieval_attempts", 0))

    assert result["answer"].strip()
