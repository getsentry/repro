# Reproduction for sdk-repro-test-python#10

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/10

## Description

With only `traces_sample_rate=0.5` set (no `traces_sampler`), continuing an
incoming sampled trace whose baggage has `sentry-sample_rate=0.01` replaces that
rate with `1.0`. Both the outgoing baggage and the `trace` header on the
transaction envelope say `sample_rate=1.0`.

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

`sentry-sample_rate=0.01` in the outgoing baggage and `sample_rate: "0.01"` in
the transaction's trace header: the incoming value, passed on unchanged.

## Actual Behavior

```
outgoing baggage: sentry-trace_id=771a43a4192642f0b136d5159a501700,sentry-sample_rate=1.0,sentry-sample_rand=0.005,sentry-sampled=true,sentry-public_key=abc
transaction envelope trace header sample_rate: '1.0'
```

## Environment

- Python: 3.12
- sentry-sdk: 2.73.0
