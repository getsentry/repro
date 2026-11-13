"""Reproduction for getsentry/sentry-python#7871.

With LanggraphIntegration enabled, Pregel.invoke() creates one
gen_ai.invoke_agent span. Pregel.stream() and Pregel.astream() should create
one as well, but they create none, because the integration only patches
invoke/ainvoke (and in LangGraph, invoke runs on top of stream, not the other
way round).

No LLM or network access is needed: the graph has a single plain-Python node.
Exits 1 when the bug reproduces, 0 otherwise.
"""

import asyncio
import sys
from typing import TypedDict

import sentry_sdk
from sentry_sdk.integrations.langgraph import LanggraphIntegration

from langgraph.graph import END, START, StateGraph


captured_spans = []


def before_send_transaction(event, hint):
    """Record the transaction's spans and drop it, so nothing is sent."""
    captured_spans.extend(event.get("spans", []))
    return None


sentry_sdk.init(
    dsn="https://public@example.com/1",
    traces_sample_rate=1.0,
    integrations=[LanggraphIntegration()],
    before_send_transaction=before_send_transaction,
)


class State(TypedDict):
    messages: list


def respond(state: State) -> State:
    return {"messages": state["messages"] + ["pong"]}


builder = StateGraph(State)
builder.add_node("respond", respond)
builder.add_edge(START, "respond")
builder.add_edge("respond", END)
graph = builder.compile(name="my_agent")


def invoke_agent_spans(run):
    """Run `run` inside a transaction and return its gen_ai.invoke_agent spans."""
    captured_spans.clear()
    with sentry_sdk.start_transaction(name="test"):
        run()
    sentry_sdk.flush()
    spans = [s for s in captured_spans if s.get("op") == "gen_ai.invoke_agent"]
    return spans


def run_invoke():
    graph.invoke({"messages": ["ping"]})


def run_stream():
    for _ in graph.stream({"messages": ["ping"]}):
        pass


def run_astream():
    async def consume():
        async for _ in graph.astream({"messages": ["ping"]}):
            pass

    asyncio.run(consume())


results = {}
for name, run in [
    ("graph.invoke()", run_invoke),
    ("graph.stream()", run_stream),
    ("graph.astream()", run_astream),
]:
    spans = invoke_agent_spans(run)
    results[name] = len(spans)
    print(f"{name:18} -> {len(spans)} gen_ai.invoke_agent span(s)"
          + "".join(f"  [{s.get('description')}]" for s in spans))

# Expected: exactly one invoke_agent span per run, whatever the entry point.
bad = [name for name, count in results.items() if count != 1]
if bad:
    print(f"\nBUG REPRODUCED: expected 1 invoke_agent span, wrong count for: {', '.join(bad)}")
    sys.exit(1)

print("\nOK: every entry point produced exactly one invoke_agent span")
