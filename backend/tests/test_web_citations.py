from app.graph.nodes.answer_generation import validate_web_citations

def test_validate_web_citations_keeps_retrieved_url():
    answer = (
        "Growth increased according to "
        "[Growth Report](https://example.com/report)."
    )
    sources = [
        {
            "source": "Growth Report",
            "url": "https://example.com/report",
            "type": "web",
        }
    ]

    result = validate_web_citations(answer, sources)

    assert result == answer


def test_validate_web_citations_removes_unretrieved_url():
    answer = (
        "See [Fake Study](https://fake-example.com/study)."
    )
    sources = [
        {
            "source": "Growth Report",
            "url": "https://example.com/report",
            "type": "web",
        }
    ]

    result = validate_web_citations(answer, sources)

    assert result == "See Fake Study."


def test_validate_web_citations_handles_no_citations():
    answer = "Customer growth increased by 15%."
    sources = [
        {
            "source": "Growth Report",
            "url": "https://example.com/report",
            "type": "web",
        }
    ]

    result = validate_web_citations(answer, sources)

    assert result == answer