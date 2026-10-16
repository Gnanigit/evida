from pathlib import Path

from pypdf import PdfReader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

def load_and_split_pdf(pdf_path: str | Path) -> list[Document]:
    # Load a PDF and split its extracted text into chunks.
    pdf_path = Path(pdf_path)

    if not pdf_path.is_file():
        raise FileNotFoundError(f"PDF file not found: ,{pdf_path}")

    reader = PdfReader(str(pdf_path))
    documents = []

    for page_number, page in enumerate(reader.pages, start = 1):
        text = page.extract_text() or ""

        if text.split():
            documents.append(
                Document(
                    page_content=text,
                    metadata = {
                        "source" : str(pdf_path.resolve()),
                        "page": page_number
                    }
                )
            )

    if not documents:
        raise ValueError(
            "No extractable text found in the PDF. "
            "Scanned PDFs may require OCR."
        )


    splitter = RecursiveCharacterTextSplitter(
        chunk_size = 1000,
        chunk_overlap = 200,
    )

    chunks = splitter.split_documents(documents)

    return chunks