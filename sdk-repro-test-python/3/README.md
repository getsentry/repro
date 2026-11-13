# Reproduction for sdk-repro-test-python#3

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/3

## Description

With `enable_logs=True`, a log attribute that holds NaN or inf can make the
whole log batch disappear without an error. `repro.py` sends four batches to a
local HTTP server on `127.0.0.1` (the DSN), each with 10 normal logs and one
special log, and counts the log items that arrive.

With `sentry-sdk==2.75.0` from PyPI, scalar NaN and inf values (the issue's
exact snippet) are sent as strings and arrive. A NaN inside a list attribute
(`attributes={"losses": [0.5, float("nan")]}`) still drops the whole batch:
the envelope JSON encoder rejects NaN, so the item is never sent.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   uv venv -p 3.12 .venv
   uv pip install -p .venv/bin/python -r requirements.txt
   ```

2. Run the reproduction:
   ```bash
   .venv/bin/python repro.py
   ```

   Exits 1 when the bug reproduces, 0 otherwise.

## Expected Behavior

Every batch delivers 11 of 11 logs (or at least the 10 normal ones).

## Actual Behavior

```
scalar nan: delivered 11 of 11
scalar inf: delivered 11 of 11
nan in list attribute: delivered 0 of 11
control: 0.5: delivered 11 of 11
```

## Environment

- Python: 3.12
- sentry-sdk: 2.75.0
