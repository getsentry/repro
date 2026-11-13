# Reproduction for sdk-repro-test-python#4

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/4

## Description

`sentry_sdk.crons.capture_checkin` always returns a check-in id, even when the SDK
sent nothing: with no active client, or when `before_send` drops the check-in.
A caller that hands the id to another process then closes a check-in that Sentry
never received.

## Steps to Reproduce

1. Install dependencies and run the reproduction:
   ```bash
   uv run repro.py
   ```

The script exits 1 when the bug reproduces and 0 when it is fixed. It sends nothing:
it uses a dummy DSN and an in-memory transport.

## Expected Behavior

`capture_checkin` returns `None` when nothing is sent, the same as
`sentry_sdk.capture_event`.

## Actual Behavior

```
[no client] capture_event -> None, capture_checkin -> '8d333121c10640d4b3b81d2341c7b7e3'
[before_send drops] capture_event -> None, capture_checkin -> 'd6d7d2d4129b494cb438c28ca301c200', envelopes sent: 0
BUG REPRODUCED:
 - no client: capture_checkin returned an id, but nothing was sent
 - before_send dropped the check-in: capture_checkin returned an id, but nothing was sent
```

## Environment

- Python: 3.12
- sentry-sdk: 2.71.0
