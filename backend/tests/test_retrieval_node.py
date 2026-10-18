
from reportlab.pdfgen import canvas

from app.graph.nodes.retrieval import retrieval_node
from app.ingestion.pdf_loader import load_and_split_pdf
from app.ingestion.vector_store import create_vector_store


def test_retrieval_node_returns_context_and_sources(tmp_path):
    # Create a sample PDF.
    pdf_path = tmp_path / "sample.pdf"

    pdf = canvas.Canvas(str(pdf_path))
    pdf.drawString(
        50, 750,
        "Evida retrieves evidence from uploaded research documents."
    )
    pdf.save()

    # Load and split the PDF.
    chunks = load_and_split_pdf(pdf_path)

    # Index the chunks in the test Chroma collection.
    create_vector_store(
        documents=chunks,
        user_id="test-user",
        document_id="test-document",
    )

    # Execute the retrieval node against that collection.
    result = retrieval_node(
        {"question": "What does Evida retrieve?"},
        config={
            "configurable": {
                "user_id": "test-user",
            }
        },
    )

    # Verify the returned state updates.
    assert len(result["context"]) > 0
    assert any("Evida" in text for text in result["context"])

    assert len(result["sources"]) > 0
    assert result["sources"][0]["page"] == 1
    assert result["sources"][0]["source"] == str(
        pdf_path.resolve()
    )

    print("Retrieved context:", result["context"])
    print("Retrieved sources:", result["sources"])
