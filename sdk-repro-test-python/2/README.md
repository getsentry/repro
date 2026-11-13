# Reproduction for sdk-repro-test-python#2

**Issue:** https://github.com/getsentry/sdk-repro-test-python/issues/2

## Description

`Baggage.serialize(include_third_party=True)` appends a trailing comma when the
incoming `baggage` header has only `sentry-` entries and no third-party items.
Strict W3C baggage parsers reject the resulting header.

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

`'sentry-trace_id=771a43a4192642f0b136d5159a501700,sentry-sample_rate=0.5'`

## Actual Behavior

`'sentry-trace_id=771a43a4192642f0b136d5159a501700,sentry-sample_rate=0.5,'`

With a third-party entry present, the output has no trailing comma.

## Environment

- Python: 3.12
- sentry-sdk: 2.73.0
