from app.graph.state import EvidaState
from app.core.config import settings
from langchain_tavily import TavilySearch

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

    except Exception:
        return {
            "technical_error": "Web search failed due to a technical issue.",
            "context": [],
            "sources": [],
        }

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

