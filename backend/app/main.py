
from fastapi import FastAPI

app = FastAPI(
    title="Evida API",
    description="Evidence-grounded answers from documents and the web.",
    version="0.1.0",
)


@app.get("/")
def root():
    return {"message": "Welcome to Evida API"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
