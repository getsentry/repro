# Reproduction for sdk-repro-test-python#22

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/22

## Description

`sentry_sdk.crons.capture_checkin` always returns a check-in id, even when the SDK sends nothing. Code that hands the id to another process to close the check-in then closes a check-in that Sentry never received. `sentry_sdk.capture_event` returns `None` in the same situations.

The script checks two cases with a dummy DSN and an in-memory transport, so nothing is sent:

1. No `sentry_sdk.init()`, so there is no active client.
2. An active client whose `before_send` drops the check-in.

It exits 1 when the bug reproduces.

## Steps to Reproduce

1. Install [uv](https://docs.astral.sh/uv/).

2. Run the reproduction:
   ```bash
   uv run repro.py
   ```

## Expected Behavior

`capture_checkin` returns `None` in both cases.

## Actual Behavior

`capture_checkin` returns a check-in id in both cases, while the transport receives no envelope:

```
[no client]      client active: False
[no client]      capture_checkin returned: 'ccdd3a2fcdcf4b11ba848cfc6f9e2767'
[before_send=None] envelopes received by transport: 0
[before_send=None] capture_checkin returned: '63009be3a4ec42c6a74d5d3a7e530b75'
BUG REPRODUCED: capture_checkin returned an id although nothing was sent (no client, before_send drop)
```

## Environment

- Python: 3.12
- sentry-sdk: 2.71.0
