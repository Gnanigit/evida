from app.graph.state import EvidaState
import json
from langchain_groq import ChatGroq
from app.core.config import settings

llm = ChatGroq(
    model =  settings.groq_model,
    api_key = settings.groq_api_key,
    temperature=0
)

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
