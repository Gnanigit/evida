from langchain_core.messages import HumanMessage, SystemMessage
from app.graph.state import EvidaState
from langchain_groq import ChatGroq
from app.core.config import settings
import re

llm = ChatGroq(
    model =  settings.groq_model,
    api_key = settings.groq_api_key,
    temperature=0
)

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


