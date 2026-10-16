
import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY is missing from backend/.env")

model = ChatGroq(
    model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    api_key=api_key,
    temperature=0,
)

response = model.invoke(
    "In one sentence, explain retrieval-augmented generation."
)

print(response.content)
