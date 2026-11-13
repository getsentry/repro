# Reproduction for sdk-repro-test-python#6

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/6

## Description

`sentry_sdk.set_user` accepts a dict whose values can be `None`. When a log is
sent, user fields set to `None` show up as the literal string `"None"` in the
log's `user.*` attributes instead of being left out.

## Steps to Reproduce

1. Install dependencies and run the reproduction:
   ```bash
   uv run repro.py
   ```

The script exits 1 when the bug reproduces and 0 when it is fixed. It sends nothing:
it uses a dummy DSN and an in-memory transport.

## Expected Behavior

`user.name` is not on the log; only `user.email` is set.

## Actual Behavior

```
user attributes on the log: {'user.name': {'value': 'None', 'type': 'string'}, 'user.email': {'value': 'ada@example.com', 'type': 'string'}}
BUG REPRODUCED: None user fields sent as the string "None": {'user.name': {'value': 'None', 'type': 'string'}}
```

## Environment

- Python: 3.12
- sentry-sdk: 2.64.0
