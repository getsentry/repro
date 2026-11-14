# Reproduction for sdk-repro-test-python#21

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/21

## Description

With `enable_logs=True`, a single log whose attribute is `nan` (or `inf`) makes
the whole log batch fail to serialize: envelope JSON is written with
`json.dumps(..., allow_nan=False)`, which raises `ValueError` on non-finite
floats. The transport swallows the error, so none of the logs in that batch
are sent and nothing is printed.

`repro.py` uses the real `HttpTransport`, but overrides `_send_request` to
record the request body instead of sending it. It sends 10 normal logs and
one log with `loss=float("nan")`, then counts the logs that reached the
transport. It exits 1 while the bug is present and 0 once it is fixed.

The bug is on `main` of `getsentry/sdk-repro-test-python`: there,
`format_attribute` passes non-finite floats through unchanged. The published
`sentry-sdk==2.75.0` on PyPI turns them into strings and does not show the
bug, so run the repro against an SDK checkout.

## Steps to Reproduce

1. Clone `getsentry/sdk-repro-test-python` next to this repo, and install it
   into a fresh environment:
   ```bash
   uv venv --python 3.12 .venv-sdk
   VIRTUAL_ENV=.venv-sdk uv pip install -e ../../../sdk-repro-test-python
   ```

2. Run the reproduction:
   ```bash
   .venv-sdk/bin/python repro.py
   ```

   For comparison, `uv run repro.py` uses the published `sentry-sdk==2.75.0`
   from `pyproject.toml` and passes.

## Expected Behavior

`delivered 11 of 11 logs` (or at least the 10 normal logs).

## Actual Behavior

`delivered 0 of 11 logs`. The NaN log takes the other 10 logs in its batch
down with it.

## Environment

- Python: 3.12
- sentry-sdk: `main` of getsentry/sdk-repro-test-python (version 2.75.0)
