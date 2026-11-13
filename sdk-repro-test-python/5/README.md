# Reproduction for sdk-repro-test-python#5

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/5

## Description

With default data scrubbing, a `password` field in a JSON request body is
replaced with `[Filtered]` when the body is a JSON object. When the body is a
JSON array of objects (for example a bulk endpoint), the same field is sent in
clear text on the Flask request event.

## Steps to Reproduce

1. Install dependencies and run the reproduction:
   ```bash
   uv run repro.py
   ```

The script exits 1 when the bug reproduces and 0 when it is fixed. It sends nothing:
it uses a dummy DSN and an in-memory transport.

## Expected Behavior

Both bodies are scrubbed:

```
object body: {'password': '[Filtered]', 'user': 'a'}
array body:  [{'password': '[Filtered]', 'user': 'a'}]
```

## Actual Behavior

```
sentry-sdk: 2.71.0
object body: {'password': '[Filtered]', 'user': 'a'}
array body:  [{'password': 'hunter2', 'user': 'a'}]
BUG REPRODUCED: password in a JSON array body was not scrubbed
```

## Environment

- Python: 3.12
- sentry-sdk: 2.71.0
- Flask: 3.1.3
