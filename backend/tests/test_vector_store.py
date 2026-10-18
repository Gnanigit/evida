from reportlab.pdfgen import canvas

from app.ingestion.pdf_loader import load_and_split_pdf
from app.ingestion.vector_store import (
    create_vector_store,
    search_documents
)

def test_store_and_search_documents(tmp_path):
    # 1. Create a temporary PDF with actual text.
    pdf_path = tmp_path / "sample_3.pdf"

    pdf = canvas.Canvas(str(pdf_path))
    pdf.drawString(
        50, 750,
        "Python is a programming language used for automation."
    )

    pdf.drawString(
        50, 720,
        "Evida retrieves evidence from uploaded documents."
    )

    pdf.save()

    # 2. Extract text and split it into chunks.
    chunks = load_and_split_pdf(pdf_path)
    assert len(chunks) > 0
    print("Number of chunks:", len(chunks))
    # 3. Store the chunks in the test Chroma collection.
    vector_store = create_vector_store(
        documents=chunks,
        user_id="test-user",
        document_id="test-document",
    )

    # 4. Search for information about Evida.
    results = search_documents(
        vector_store=vector_store,
        question="What does Evida do?",
        user_id="test-user",
        k=2,
    )

    # 5. Verify that relevant text was retrieved.
    assert len(results) > 0

    retrieved_text = " ".join(
        document.page_content for document in results
    )

    assert "Evida" in retrieved_text
    assert any(
        document.metadata.get("page") == 1
        for document in results
    )

    print("Retrieved text:", retrieved_text)
