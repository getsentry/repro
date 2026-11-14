# Reproduction for sdk-repro-test-python#29

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/29

## Description

Starlette's `BaseHTTPMiddleware` catches single-exception `ExceptionGroup`s and
re-raises the inner exception from inside the `except` block. Python then sets
`inner.__context__ = group`, while `group.exceptions == (inner,)`, so the
exception graph has a cycle: group -> inner (sub-exception) -> group (context).

`capture_exception(group)` walks that graph without noticing the cycle and
fails with `RecursionError`, so the event is never sent.

`repro.py` builds the same cycle without FastAPI, captures envelopes with an
in-memory transport, and sends nothing. It exits 1 while the bug is present and
0 once it is fixed.

## Steps to Reproduce

1. Install dependencies and run the reproduction against the published SDK
   from the issue (`sentry-sdk==2.56.0`):
   ```bash
   uv run --python 3.12 repro.py
   ```

2. To run it against an SDK checkout instead (the bug is also on `main` of
   `getsentry/sdk-repro-test-python`, version 2.75.0), clone it next to this
   repo and install it into a fresh environment:
   ```bash
   uv venv --python 3.12 .venv-sdk
   VIRTUAL_ENV=.venv-sdk uv pip install -e ../../../sdk-repro-test-python
   .venv-sdk/bin/python repro.py
   ```

## Expected Behavior

`capture_exception` returns normally, and the script prints
`envelopes sent: 1` and `OK`.

## Actual Behavior

```
inner.__context__ is group: True
BUG: capture_exception raised RecursionError: maximum recursion depth exceeded
```

## Environment

- Python: 3.12
- sentry-sdk: 2.56.0 (also on 2.75.0 / `main` of sdk-repro-test-python)
