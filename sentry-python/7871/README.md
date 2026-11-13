# Reproduction for sentry-python#7871

**Issue:** https://github.com/getsentry/sentry-python/issues/7871

## Description

With `LanggraphIntegration` enabled, running a compiled graph with `graph.invoke()` creates one `gen_ai.invoke_agent` span, but running the same graph with `graph.stream()` or `graph.astream()` creates none. The integration only patches `Pregel.invoke` and `Pregel.ainvoke`. In LangGraph, `invoke` is built on top of `stream`, so streaming calls never go through the patched methods.

The graph has one plain-Python node, so no LLM, API key, or network access is needed. Spans are collected in `before_send_transaction`, and nothing is sent.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Run the reproduction:
   ```bash
   python repro.py
   ```

The script exits 1 when the bug reproduces and 0 when every entry point creates exactly one `invoke_agent` span.

## Expected Behavior

```
graph.invoke()     -> 1 gen_ai.invoke_agent span(s)  [invoke_agent my_agent]
graph.stream()     -> 1 gen_ai.invoke_agent span(s)  [invoke_agent my_agent]
graph.astream()    -> 1 gen_ai.invoke_agent span(s)  [invoke_agent my_agent]
```

## Actual Behavior

```
graph.invoke()     -> 1 gen_ai.invoke_agent span(s)  [invoke_agent my_agent]
graph.stream()     -> 0 gen_ai.invoke_agent span(s)
graph.astream()    -> 0 gen_ai.invoke_agent span(s)

BUG REPRODUCED: expected 1 invoke_agent span, wrong count for: graph.stream(), graph.astream()
```

## Environment

- Python: 3.12
- sentry-sdk: 2.75.0
- langgraph: 1.2.13 (langchain-core 1.8.0)
