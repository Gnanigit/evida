from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from app.core.config import settings
from app.graph.state import EvidaState
from langchain_tavily import TavilySearch
import re
import json

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
    prompt = f"""
    Classify the user's question into exactly one category:

    - general: Stable facts, explanations, or concepts that can be
      answered using general knowledge.
    - retrieval: Questions about uploaded documents or information
      that should be answered from the document collection.
    - web: Questions about recent events, current information, or
      external facts that require web research.

    Return only one word: general, retrieval, or web.

    Question: {state["question"]}
    """

    response = llm.invoke(prompt)
    decision = response.content.strip().lower()

    if decision not in ("general", "retrieval", "web"):
        decision = "general"

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

    query = state.get("rewritten_query") or state["question"]

    attempts = state.get("retrieval_attempts", 0) + 1

    vector_store = open_vector_store(persist_directory)

    documents = search_documents(
        vector_store=vector_store,
        question=query,
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
        "retrieval_attempts": attempts,
    }


def grade_evidence_node(state: EvidaState) -> dict:
    # Evaluate whether retrieved document chunks are relevant.
    context = "\n\n".join(state.get("context",[]))

    if not context.strip():
        return {"evidence_grade": "irrelevant"}

    prompt = f"""
    You are evaluating evidence for Evida, An AI research assistant.

    Determine whether the provided document evidence is relevant to answer the user's question.

    Return exactly one word:
    relevant
    irrelevant

    Question: {state["question"]}

    Document Evidence: {context}
    """
    response = llm.invoke(prompt)
    grade = response.content.strip().lower()

    if grade not in ("relevant", "irrelevant"):
        grade = "irrelevant"

    return {"evidence_grade": grade}


def rewrite_query_node(state: EvidaState) -> dict:
    # Rewrite the question to improve document retrieval.
    prompt = f"""
    You are improving a search query for Evida, an AI research assistant.

    The original question did not retrieve relevant document evidence.

    Rewrite the question as a concise, standalone search query that is
    more likely to retrieve useful passages from the document collection.

    Rules:
    - Preserve the user's original intent.
    - Keep important names, topics, and technical terms.
    - Use alternative keywords where helpful.
    - Do not answer the question.
    - Return only the rewritten search query.

    Original question:
    {state["question"]}

    Previous search query:
    {state.get("rewritten_query") or state["question"]}

    Rewritten search query:
    """

    response = llm.invoke(prompt)
    rewritten_query = response.content.strip()

    # Fall back to the original question if the model returns no query.
    if not rewritten_query:
        rewritten_query = state["question"]

    return {"rewritten_query": rewritten_query}

# Answer using the retrieval evidence from docs
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



# Search the web when document retrieval is insufficient.
def web_search_node(state: EvidaState) -> dict:
    search_query = (
        state.get("rewritten_query") or state["question"]
    )

    try:
        tavily = TavilySearch(
            tavily_api_key=settings.tavily_api_key,
            max_results=5,
            topic="general",
        )

        results = tavily.invoke({"query": search_query})

    except Exception as exc:
        raise RuntimeError(
            f"Web search failed due to a technical error: {exc}"
        ) from exc

    # Normalize the returned results into a consistent structure.
    if isinstance(results, dict):
        results = results.get("results", [])

    web_context = []
    web_sources = []

    for result in results:
        content = result.get("content", "")
        url = result.get("url", "")
        title = result.get("title", "")

        if content.strip():
            web_context.append(
                f"Title: {title}\n"
                f"URL: {url}\n"
                f"Content: {content}"
            )

        if url:
            web_sources.append({
                "source": title or url,
                "url": url,
                "type": "web",
            })

    return {
        "context": web_context,
        "sources": web_sources,
    }



# Evaluate whether web results sufficiently answer the question.
def web_evidence_grade_node(state: EvidaState) -> dict:
    context = "\n\n".join(state.get("context",[]))

    if not context.strip():
        return {"evidence_grade": "irrelevant"}

    prompt = f"""
    You are evaluating web evidence for Evida, an AI research assistant.

    Determine whether the web evidence is both relevant and sufficient
    to answer the user's original question.

    Return exactly one word:
    relevant
    irrelevant

    Mark evidence as relevant only when it:
    - Directly addresses the question.
    - Contains enough specific information to support an answer.
    - Does not require inventing missing facts.

    If the question has multiple parts, the evidence should cover
    the important parts of the question.

    Question:
    {state["question"]}

    Web evidence:
    {context}
    """

    response = llm.invoke(prompt)

    grade = response.content.strip().lower()

    if grade not in ("relevant", "irrelevant"):
        grade = "irrelevant"

    return {"evidence_grade": grade}



def validate_web_citations(answer: str, sources: list[dict]) -> str:
    """Remove Markdown citations whose URLs were not retrieved."""

    allowed_urls = {
        source["url"]
        for source in sources
        if source.get("type") == "web" and source.get("url")
    }

    citation_pattern = r"\[([^\]]+)\]\((https?://[^)\s]+)\)"

    def replace_citation(match):
        label = match.group(1)
        url = match.group(2)

        if url in allowed_urls:
            return match.group(0)

        return label

    return re.sub(citation_pattern, replace_citation, answer)


# Generate an answer grounded in graded web evidence.
def web_answer_node(state: EvidaState) -> dict:
    context = "\n\n".join(state.get("context", []))

    if not context.strip():
        return {
            "answer": (
                "I couldn't find sufficient web evidence to answer "
                "this question reliably."
            )
        }

    prompt = f"""
    You are Evida, an evidence-grounded AI research assistant.

    Answer the user's original question using only the web evidence below.

    Rules:
    - Answer using only the web evidence provided.
    - Do not invent facts or make unsupported claims.
    - Cite a source only if its exact URL appears in the web evidence.
    - Never invent, modify, or guess a source URL.
    - Place citations next to the claims they support.
    - Use inline citations in this format: [Source](https://example.com/page).
    - If the evidence only partially answers the question, explain what
    remains unanswered.
    - If sources conflict, clearly describe the disagreement.
    - Do not claim to have verified information that the evidence
    does not establish.

    Original question:
    {state["question"]}

    Web evidence:
    {context}

    Answer:
    """

    response = llm.invoke(prompt)

    validated_answer = validate_web_citations(
    response.content,
    state.get("sources", []),
    )

    return {"answer": validated_answer}


def verify_claims_node(state: EvidaState) -> dict:
    answer = state.get("answer","")

    context =  "\n\n".join(state.get("context", []))

    if not answer.strip() or not context.strip():
        return {"verification_results": []}

    prompt = f"""
    You are Evida's claim verification component
    Verify each factual claim in the generated answer against
    the retrieved web evidence.

    Classify each claim using exactly one status:
    - supported: the evidence supports the claim.
    - contradicted: the evidence conflicts with the claim.
    - not_supported: the evidence does not establish the claim.

    Rules:
    - Break the answer into individual factual claims.
    - Evaluate claims using only the retrieved evidence.
    - Do not treat a URL or source title as proof of a claim.
    - Do not invent evidence or quotations.
    - For supported or contradicted claims, provide a short
      explanation grounded in the evidence.
    - For not_supported claims, explain what evidence is missing.
    - Preserve numerical values and dates exactly as stated
      in the evidence.
    - Return valid JSON only. Do not use Markdown fences.

    Use this JSON structure:
    {{
      "claims": [
        {{
          "claim": "The factual claim being checked.",
          "status": "supported",
          "evidence": "Relevant evidence or explanation."
        }}
      ]
    }}

    Generated answer:
    {answer}

    Retrieved web evidence:
    {context}
    """
    response = llm.invoke(prompt)

    try:
        result = json.loads(response.content)
        claims = result["claims"]

        if not isinstance(claims, list):
            raise ValueError("The claims field must be a list.")

        valid_statuses = {
            "supported",
            "contradicted",
            "not_supported",
        }

        for claim in claims:
            if not isinstance(claim, dict):
                raise ValueError("Each claim must be an object.")

            if not isinstance(claim.get("claim"), str):
                raise ValueError("Each claim must have text.")

            if claim.get("status") not in valid_statuses:
                raise ValueError("Invalid claim verification status.")

            if not isinstance(claim.get("evidence"), str):
                raise ValueError("Each claim must have evidence text.")

        return {"verification_results": claims}

    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        # Fail closed: do not treat malformed verification as success.
        return {"verification_results": []}



# Construct a final answer from verified claims.
def finalize_verified_answer_node(state: EvidaState) -> dict:
    verification_results = state.get("verification_results", [])

    if not verification_results:
        fallback = (
            "I couldn't verify the claims in the generated answer "
            "against the available evidence, so I can't provide "
            "a reliably verified answer."
        )
        return {
            "verified_answer": fallback,
            "answer": fallback,
        }

    supported_claims = [
        item["claim"]
        for item in verification_results
        if item.get("status") == "supported"
    ]

    if not supported_claims:
        fallback = (
            "The available evidence did not establish any of the "
            "claims in the generated answer reliably."
        )
        return {
            "verified_answer": fallback,
            "answer": fallback,
        }

    prompt = f"""
    You are Evida, an evidence-grounded research assistant.

    Construct a concise final answer using only the supported claims
    and the retrieved web evidence.

    Rules:
    - Include only claims marked supported.
    - Do not repeat contradicted or not-supported claims as facts.
    - Do not introduce new factual claims.
    - Preserve the meaning and numerical values of supported claims.
    - Preserve citations only when their URLs appear in the retrieved
      evidence.
    - If some aspects of the user's question remain unanswered,
      state that limitation clearly.

    Original question:
    {state["question"]}

    Supported claims:
    {supported_claims}

    Retrieved web evidence:
    {"\n\n".join(state.get("context", []))}

    Original generated answer:
    {state.get("answer", "")}

    Final answer:
    """

    response = llm.invoke(prompt)

    validated_answer = validate_web_citations( 
        response.content,
        state.get("sources", []),
    )

    return {
        "verified_answer": validated_answer,
        "answer": validated_answer,
    }


# insufficient evidence
def insufficient_evidence_node(state: EvidaState) -> dict:
    """Explain when available evidence cannot answer the question."""
    return {
        "answer": (
            "I couldn't find sufficiently relevant and complete "
            "evidence in the available sources to answer this "
            "question reliably."
        )
    }



