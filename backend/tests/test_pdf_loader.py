from pypdf import PdfWriter

from reportlab.pdfgen import canvas

from app.ingestion.pdf_loader import load_and_split_pdf

def test_load_and_split_pdf_without_text(tmp_path):
    # Create a temporary PDF for testing.

    pdf_path = tmp_path / "sample_1.pdf"

    writer = PdfWriter()
    writer.add_blank_page(width=300, height=300)

    with open(pdf_path, "wb") as file:
        writer.write(file)

    try:
        load_and_split_pdf(pdf_path)
    except ValueError as error:
        assert "No extractable text" in str(error)
    else:
        raise AssertionError("Expected ValueError for a blank PDF")



def test_load_and_split_pdf_with_text(tmp_path):
    pdf_path = tmp_path / "sample_2.pdf"

    # Generate a PDF containing real text.
    pdf = canvas.Canvas(str(pdf_path))
    pdf.drawString(50, 750, "Evida is an evidence-grounded research assistant.")
    pdf.drawString(50, 720, "It retrieves relevant information from documents.")
    pdf.save()

    # Load the PDF and split its text.
    chunks = load_and_split_pdf(pdf_path)

    # Verify that chunks were created.
    assert len(chunks) > 0

    # Verify that the extracted text is present.
    combined_text = " ".join(chunk.page_content for chunk in chunks)
    assert "Evida" in combined_text
    assert "evidence-grounded research assistant" in combined_text

    # Verify source and page metadata.
    assert chunks[0].metadata["source"] == str(pdf_path.resolve())
    assert chunks[0].metadata["page"] == 1

    print("Extracted text:", combined_text)
    print("Number of chunks:", len(chunks))
