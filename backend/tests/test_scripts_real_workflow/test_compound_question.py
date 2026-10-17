from pprint import pprint

from app.graph.workflow import graph

question = (
    "According to the Northstar Learning customer growth report, "
    "how much did registered customers grow in 2025, "
    "and what are the latest official Python release updates?"
)

print("\nRunning mixed document + web compound-question test...")
result = graph.invoke(
    {"question": question},
    config={
        "configurable": {
            "user_id": "test-user",
        }
    },
)

print("\n=== ORIGINAL QUESTION ===")
print(question)

print("\n=== DECOMPOSED SUBQUESTIONS ===")
pprint(result.get("sub_questions"))

print("\n=== OVERALL ROUTE ===")
print(result.get("route"))

print("\n=== SUB-ANSWERS ===")
pprint(result.get("sub_answers"))

print("\n=== FINAL ANSWER ===")
print(result.get("answer"))

print("\n=== SOURCES ===")
pprint(result.get("sources"))

print("\n=== CHECK EACH SUB-ANSWER ===")
sub_answers = result.get("sub_answers") or []

for index, item in enumerate(sub_answers, start=1):
    print(f"\nSub-answer {index}:")
    print("Question:", item.get("question"))
    print("Answer:", item.get("answer"))
    print("Route:", item.get("route"))
    print("Sources:")
    pprint(item.get("sources") or [])

print("\n=== WEB URL CHECK ===")
all_sources = list(result.get("sources") or [])

for item in sub_answers:
    all_sources.extend(item.get("sources") or [])

web_sources = [
    source
    for source in all_sources
    if isinstance(source, dict)
    and str(source.get("url", "")).startswith(("http://", "https://"))
]

print("HTTP(S) source URLs found:", len(web_sources))
pprint(web_sources)