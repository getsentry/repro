# Reproduction for sdk-repro-test-python#25

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/25

## Description

When a client sends the `sentry-trace` header twice, many server frameworks join the repeated headers into one comma-separated value. `sentry_sdk.continue_trace` does not parse that value, so it starts a new trace instead of continuing the incoming one, and the trace is split.

The cause is in `sentry_sdk/tracing_utils.py`: `extract_sentrytrace_data` matches the whole header against `SENTRY_TRACE_REGEX`, which is anchored with `^…$`. A comma-joined value does not match, so the function returns `None` and the incoming trace is dropped.

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

The script exits with `1` when the bug reproduces.

## Expected Behavior

The transaction continues from the first header value:

```
trace_id=efa64e95faf54da59b81cce3fb159825 parent_span_id=b8efba9273e7a14f
```

## Actual Behavior

A single header is continued, but the comma-joined header starts a new random trace with no parent span:

```
sentry-sdk 2.64.0
single header:     trace_id=efa64e95faf54da59b81cce3fb159825 parent_span_id=b8efba9273e7a14f
joined headers:    trace_id=6aa83115cbad4dc4992d1ba4daca8e39 parent_span_id=None
expected (joined): trace_id=efa64e95faf54da59b81cce3fb159825 parent_span_id=b8efba9273e7a14f

BUG REPRODUCED: the comma-joined sentry-trace header started a new trace.
```

The same result happens with the current `getsentry/sdk-repro-test-python` source (2.75.0).

## Environment

- Python: 3.12
- sentry-sdk: 2.64.0
