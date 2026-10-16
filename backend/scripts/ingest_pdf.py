
from pathlib import Path

from app.ingestion.pdf_loader import load_and_split_pdf
from app.ingestion.vector_store import create_vector_store


# Project paths
BACKEND_DIR = Path(__file__).resolve().parents[1]
PDF_PATH = BACKEND_DIR / "documents" / "sample.pdf"
DB_PATH = BACKEND_DIR / "chroma_db"

# Load a PDF, split it into chunks, and store it in Chroma.
def main() -> None:
    print(f"Loading PDF: {PDF_PATH}")

    if not PDF_PATH.is_file():
        raise FileNotFoundError(
            f"PDF not found: {PDF_PATH}"
        )

    # Extract text and split it into chunks.
    chunks = load_and_split_pdf(PDF_PATH)

    print(f"Extracted {len(chunks)} chunks from the PDF.")

    # Store chunks and their embeddings in Chroma.
    create_vector_store(
        documents=chunks,
        persist_directory=DB_PATH,
    )

    print(f"PDF ingestion completed successfully.")
    print(f"Chunks stored in: {DB_PATH}")


if __name__ == "__main__":
    main()
