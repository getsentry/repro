# Reproduction for sdk-repro-test-python#24

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/24

## Description

With `send_default_pii=True` and `enable_logs=True`, calling
`set_user({"email": "ada@example.com", "username": None})` adds
`user.name: "None"` (a string) to every log. The scope copies each user field
into telemetry attributes when the key is present, even when its value is
`None`, and attribute serialization then turns `None` into the string `"None"`.
Spans in streaming mode get the user attributes the same way.

`repro.py` records envelopes with an in-memory transport, sends one log, and
prints the `user.*` attributes on it. It exits 1 while the bug is present and
0 once it is fixed.

## Steps to Reproduce

1. Run the reproduction against the published SDK version from the issue:
   ```bash
   uv run repro.py
   ```

2. To run it against an SDK checkout instead, clone
   `getsentry/sdk-repro-test-python` next to this repo and install it into a
   fresh environment:
   ```bash
   uv venv --python 3.12 .venv-sdk
   VIRTUAL_ENV=.venv-sdk uv pip install -e ../../../sdk-repro-test-python
   .venv-sdk/bin/python repro.py
   ```

## Expected Behavior

Only `user.email` is set on the log. `user.name` is left out.

## Actual Behavior

```
user attributes on the log: {'user.name': {'value': 'None', 'type': 'string'}, 'user.email': {'value': 'ada@example.com', 'type': 'string'}}
```

## Environment

- Python: 3.12
- sentry-sdk: 2.64.0 (also on `main` of getsentry/sdk-repro-test-python, version 2.75.0)
