# Reproduction for sdk-repro-test-python#9

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/9

## Description

Falcon 3+ lets `resp.status` be an int. When an error handler sets an int status, the Sentry Falcon integration calls `.startswith()` on it to check for a 5xx response, and the request crashes.

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

The script exits 1 when the bug reproduces and 0 when the request returns 404.

## Expected Behavior

The request returns `404`, as it does without Sentry.

## Actual Behavior

```
BUG REPRODUCED: request crashed with AttributeError: 'int' object has no attribute 'startswith'
```

## Environment

- Python: 3.12
- sentry-sdk: 2.73.0
- falcon: 4.4.0
