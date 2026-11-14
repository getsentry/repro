# Reproduction for sdk-repro-test-python#28

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/28

## Description

A backend with only `traces_sample_rate=0.5` (no `traces_sampler`) continues a
sampled trace whose incoming baggage has `sentry-sample_rate=0.01`. The SDK
replaces the incoming sample rate with `1.0` in the baggage it propagates and in
the trace header (dynamic sampling context) of the transaction envelope it sends.

## Steps to Reproduce

1. Install dependencies and run the reproduction:
   ```bash
   uv run python main.py
   ```

The script exits with 1 when the bug reproduces and 0 when the incoming sample
rate is passed on unchanged. It uses a dummy DSN and an in-memory transport, so
nothing is sent.

## Expected Behavior

Both the outgoing baggage and the transaction trace header carry
`sample_rate=0.01`, the incoming value.

## Actual Behavior

Both carry `sample_rate=1.0`:

```
outgoing baggage: sentry-trace_id=771a43a4192642f0b136d5159a501700,sentry-sample_rate=1.0,sentry-sample_rand=0.005,sentry-sampled=true,sentry-public_key=public
transaction envelope trace header: {'trace_id': '771a43a4192642f0b136d5159a501700', 'sample_rate': '1.0', 'sample_rand': '0.005', 'sampled': 'true', 'public_key': 'public'}
BUG REPRODUCED: expected sample_rate=0.01, but baggage sample_rate is '1.0'; trace header sample_rate is '1.0'
```

## Environment

- Python: 3.12
- sentry-sdk: 2.73.0
