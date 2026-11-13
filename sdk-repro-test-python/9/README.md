# Reproduction for sdk-repro-test-python#9

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/9

## Description

Falcon 3+ allows `resp.status` to be an int. When a Falcon error handler sets
an int status (`resp.status = 404`) and the Sentry Falcon integration is
enabled, the request crashes inside the integration's `_has_http_5xx_status`,
which calls `response.status.startswith("5")`.

## Steps to Reproduce

```bash
uv run main.py
```

The script exits 1 when the bug reproduces and 0 when the request returns 404.

## Expected Behavior

The request returns `404`, as it does without Sentry.

## Actual Behavior

```
AttributeError: 'int' object has no attribute 'startswith'
```

## Environment

- Python: 3.12
- falcon: 4.4.0
- sentry-sdk: 2.73.0
