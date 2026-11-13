# Reproduction for sdk-repro-test-python#8

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/8

## Description

With Starlette's `AuthenticationMiddleware` and `send_default_pii=True`, the Starlette integration overwrites the user that the endpoint sets with `sentry_sdk.set_user(...)`. The transaction only carries the auth backend's `username`; the `id` and `email` set by the app are gone.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   uv venv -p 3.12 .venv && uv pip install -p .venv -r requirements.txt
   ```

2. Run the reproduction:
   ```bash
   .venv/bin/python repro.py
   ```

The script exits `1` while the bug is present and `0` once the user set in the endpoint is kept.

## Expected Behavior

The transaction user is `{'id': 'user_42', 'email': 'real@user.com', 'username': 'token-subject-123'}`.

## Actual Behavior

The transaction user is `{'username': 'token-subject-123'}`. The integration calls `set_user` again after the endpoint returns and replaces the whole user.

## Environment

- Python: 3.12
- sentry-sdk: 2.64.0
- starlette: 1.10.0
- httpx: 0.28.1 (for `TestClient`)
