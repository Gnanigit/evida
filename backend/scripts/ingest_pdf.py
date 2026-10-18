import argparse
from pathlib import Path

from app.core.config import settings
from app.ingestion.pdf_loader import load_and_split_pdf
from app.ingestion.vector_store import create_vector_store


# Project paths
BACKEND_DIR = Path(__file__).resolve().parents[1]
PDF_PATH = BACKEND_DIR / "documents" / "sample.pdf"

# Load a PDF, split it into chunks, and store it in Chroma Cloud.
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Index a PDF into Chroma Cloud for a user."
    )
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--document-id", required=True)
    parser.add_argument("--pdf", type=Path, default=PDF_PATH)
    args = parser.parse_args()

    print(f"Loading PDF: {args.pdf}")

    if not args.pdf.is_file():
        raise FileNotFoundError(
            f"PDF not found: {args.pdf}"
        )

    # Extract text and split it into chunks.
    chunks = load_and_split_pdf(args.pdf)

    print(f"Extracted {len(chunks)} chunks from the PDF.")

    # Store chunks and their embeddings in Chroma.
    create_vector_store(
        documents=chunks,
        user_id=args.user_id,
        document_id=args.document_id,
    )

    print(f"PDF ingestion completed successfully.")
    print(
        f"Chunks stored in Chroma Cloud collection: "
        f"{settings.collection_name}"
    )


if __name__ == "__main__":
    main()
