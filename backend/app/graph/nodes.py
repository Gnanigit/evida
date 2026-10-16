from pathlib import Path
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from app.core.config import settings
from app.graph.state import EvidaState

from app.ingestion.vector_store import (
    DEFAULT_DB_PATH,
    open_vector_store,
    search_documents
)


llm = ChatGroq(
    model =  settings.groq_model,
    api_key = settings.groq_api_key,
    temperature=0
)

def router_node(state: EvidaState) -> dict:
    # Choose whether a question needs document retrieval.
    prompt = f"""
    Classify the user's question into exactly one category:

    - general: The question can be answered using general knowledge.
    - retrieval: The question asks about uploaded documents, their contents,
    or information that requires evidence from a document collection.

    Return only one word: general or retrieval.

    Question: {state["question"]}
    """

    response = llm.invoke(prompt)

    decision = response.content.strip().lower()

    if decision not in ("general", "retrieval"):
        decision = "retrieval"

    return {"route": decision}


def general_answer_node(state: EvidaState) -> dict:
    # Answer a general question directly using the LLM.
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are Evida, a helpful research assistant. "
                    "Answer clearly and accurately. If you are uncertain, "
                    "say so rather than inventing facts."
                )
            ),
            HumanMessage(state["question"])
        ]
    )

    return {"answer" : response.content}


# config is for testing the retrieval node and rag flow, In real usage it directly uses the 'DEFAULT_DB_PATH'
def retrieval_node(
    state: EvidaState,
    config: RunnableConfig | None = None,
) -> dict:
    """Retrieve relevant document chunks from Chroma."""

    configurable = (config or {}).get("configurable", {})
    persist_directory = configurable.get(
        "persist_directory",
        str(DEFAULT_DB_PATH),
    )

    vector_store = open_vector_store(persist_directory)

    documents = search_documents(
        vector_store=vector_store,
        question=state["question"],
        k=3,
    )

    return {
        "context": [
            document.page_content for document in documents
        ],
        "sources": [
            {
                "source": document.metadata.get("source", "unknown"),
                "page": document.metadata.get("page"),
            }
            for document in documents
        ],
    }



def retrieval_answer_node(state: EvidaState) -> dict:
    # Answer the question using retrieved document evidence.
    context = "\n\n".join(state.get("context",[]))

    if not context.strip():
        return {
            "answer" : (
                "I couldn't find relevant evidence in the "
                "available documents to answer this question."
            )
        }

    prompt = f"""
    You are Evida, and evidence grounded research assistant

    Answer the user's question using only the evidence provided below.
    Do not invent facts are introduce unsupported claims.
    If the evidence does not fully answer the question. clearly state
    what information is missing.
    
    Question:
    {state["question"]}

    Evidence:
    {context}

    Answer:
    """
    response = llm.invoke(prompt)

    return {"answer" : response.content}