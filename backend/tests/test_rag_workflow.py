
from reportlab.pdfgen import canvas

from app.graph.workflow import graph
from app.ingestion.pdf_loader import load_and_split_pdf
from app.ingestion.vector_store import create_vector_store


def test_document_question_uses_retrieved_evidence(tmp_path):
    # Create a PDF containing specific facts.
    pdf_path = tmp_path / "evida_notes.pdf"

    pdf = canvas.Canvas(str(pdf_path))
    pdf.drawString(
        50, 750,
        "Evida is a research assistant that retrieves evidence "
        "from uploaded documents."
    )
    pdf.drawString(
        50, 720,
        "Evida uses Chroma to store document embeddings."
    )
    pdf.save()

    # Extract and split the PDF text.
    chunks = load_and_split_pdf(pdf_path)

    # Index the chunks in a temporary Chroma database.
    db_path = tmp_path / "chroma_db"

    create_vector_store(
        documents=chunks,
        persist_directory=db_path,
    )

    # Run the workflow against the same database.
    result = graph.invoke(
        {
            "question": "According to my notes, what does Evida do?",
        },
        config={
            "configurable": {
                "persist_directory": str(db_path),
            }
        },
    )

    assert result["route"] == "retrieval"
    assert len(result["context"]) > 0
    assert len(result["sources"]) > 0
    assert isinstance(result["answer"], str)
    assert len(result["answer"].strip()) > 0

    print("Retrieved evidence:", result["context"])
    print("Answer:", result["answer"])
