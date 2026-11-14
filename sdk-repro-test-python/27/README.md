# Reproduction for sdk-repro-test-python#27

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/27

## Description

Falcon 3+ allows `resp.status` to be an int. When an error handler sets an int
status, the Sentry Falcon integration calls `response.status.startswith("5")`
while deciding whether the exception led to a 5xx, and the request crashes with
`AttributeError: 'int' object has no attribute 'startswith'`.

## Steps to Reproduce

1. Install dependencies and run the reproduction:
   ```bash
   uv run python main.py
   ```

The script exits with 1 when the bug reproduces and 0 when the app returns 404.
It uses a dummy DSN and sends nothing.

## Expected Behavior

The request returns `404`, as it does without Sentry.

## Actual Behavior

The request crashes:

```
File ".../sentry_sdk/integrations/falcon.py", in _has_http_5xx_status
    return response.status.startswith("5")
AttributeError: 'int' object has no attribute 'startswith'
```

Setting `resp.status = "404 Not Found"` works around it.

## Environment

- Python: 3.12
- falcon: 4.4.0
- sentry-sdk: 2.73.0
