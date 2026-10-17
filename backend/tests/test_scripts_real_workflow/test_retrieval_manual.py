from app.graph.workflow import graph


def main() -> None:
    question = "What was Northstar Learning's customer churn rate in 2025?"

    initial_state = {
        "question": question,
        "route": "retrieval",
        "context": [],
        "sources": [],
        "evidence_grade": None,
        "answer": "",
    }

    print("\n--- Question ---")
    print(question)

    print("\n--- Workflow Execution ---")

    final_state = initial_state.copy()

    # Stream node updates to see which path the graph follows.
    for update in graph.stream(initial_state, stream_mode="updates"):
        for node_name, node_update in update.items():
            print(f"Executed node: {node_name}")
            final_state.update(node_update)

    print("\n--- Final Evidence Grade ---")
    print(final_state.get("evidence_grade"))

    print("\n--- Retrieval Attempts ---")
    print(final_state.get("retrieval_attempts", 0))

    print("\n--- Final Answer ---")
    print(final_state.get("answer", "No answer returned."))

    print("\n--- Sources ---")
    for source in final_state.get("sources", []):
        print(source)


if __name__ == "__main__":
    main()