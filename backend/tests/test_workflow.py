from app.graph.workflow import graph

def test_general_question():
    result = graph.invoke(
        {
            "question":"What is Python?"
        }
    )

    assert result["route"] == "general"
    assert isinstance(result["answer"], str)
    assert len(result["answer"]) > 0
    print(result["answer"])