# Reproduction for sdk-repro-test-python#7

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/7

## Description

When the `sentry-trace` header is sent twice, many server frameworks join the
repeated values into one comma-separated string. `sentry_sdk.continue_trace`
does not recognize that value and starts a new trace, so the trace is split.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   uv venv -p 3.12 .venv
   uv pip install -p .venv -r requirements.txt
   ```

2. Run the reproduction:
   ```bash
   .venv/bin/python repro.py
   ```

   It exits with code 1 while the bug is present and 0 once it is fixed.

## Expected Behavior

The transaction continues the trace from the first header value:
`trace_id=efa64e95faf54da59b81cce3fb159825`, `parent_span_id=b8efba9273e7a14f`.

## Actual Behavior

The transaction gets a new random trace id and `parent_span_id` is `None`.

## Environment

- Python: 3.12
- sentry-sdk: 2.64.0
