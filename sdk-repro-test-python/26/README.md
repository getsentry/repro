# Reproduction for sdk-repro-test-python#26

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/26

## Description

With `StarletteIntegration`, `send_default_pii=True` and Starlette's
`AuthenticationMiddleware`, the user an endpoint sets with
`sentry_sdk.set_user(...)` is replaced after the endpoint returns. The SDK's
patch of `AuthenticationMiddleware.__call__` copies the auth backend's user
(here only `username`) onto the Sentry scope with `set_user`, which drops the
`id` and `email` the endpoint set. Events and transactions that finish after
that only carry `username`.

`repro.py` uses the app from the issue, captures the transaction in
`before_send_transaction`, and sends nothing. It exits 1 while the bug is
present and 0 once it is fixed.

## Steps to Reproduce

1. Run the reproduction against the SDK version from the issue
   (`sentry-sdk==2.64.0`):
   ```bash
   uv run --python 3.12 repro.py
   ```

2. To run it against an SDK checkout instead (the bug is also on `main` of
   `getsentry/sdk-repro-test-python`, version 2.75.0), clone it next to this
   repo and install it into a fresh environment:
   ```bash
   uv venv --python 3.12 /tmp/venv-26
   VIRTUAL_ENV=/tmp/venv-26 uv pip install -e ../../../sdk-repro-test-python "starlette>=1,<2" httpx
   /tmp/venv-26/bin/python repro.py
   ```

## Expected Behavior

```
captured user: {'id': 'user_42', 'email': 'real@user.com', 'username': 'token-subject-123'}
```

## Actual Behavior

```
sentry_sdk version: 2.64.0
expected user: {'id': 'user_42', 'email': 'real@user.com', 'username': 'token-subject-123'}
captured user: {'username': 'token-subject-123'}
BUG REPRODUCED: the user set in the endpoint was overwritten
```

## Environment

- Python: 3.12
- sentry-sdk: 2.64.0 (also 2.75.0 on `main`)
- starlette: 1.10.0
