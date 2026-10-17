import app.graph.nodes.decomposition as nodes


def test_decomposition_falls_back_when_subquestions_are_invalid(monkeypatch):
    class FakeResponse:
        content = '{"sub_questions": ["First question", 123]}'

    class FakeLLM:
        def invoke(self, prompt):
            return FakeResponse()

    monkeypatch.setattr(nodes, "llm", FakeLLM())

    question = "What changed, and why?"

    result = nodes.decompose_question_node({"question": question})

    assert result["sub_questions"] == [question]