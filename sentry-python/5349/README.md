# Reproduction for sentry-python#5349

**Issue:** https://github.com/getsentry/sentry-python/issues/5349

## Description

This reproduces the issue where `requests` library calls show incorrect/very short timing (< 1ms) in `http.client` spans with sentry-sdk 2.x. In version 1.45, the spans correctly measured the actual HTTP request duration.

The user reports that after upgrading from sentry-sdk 1.45 to 2.49, the `http.client` spans show impossibly short durations that don't reflect the actual I/O time spent on HTTP requests.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   uv sync
   ```

2. Set your Sentry DSN:
   ```bash
   export SENTRY_DSN=your_dsn_here
   ```

3. Run the reproduction:
   ```bash
   uv run python main.py
   ```

4. Make requests to the endpoints:
   ```bash
   # Single request (should take ~1 second)
   curl http://localhost:8000/

   # Multiple requests (should take ~3 seconds total)
   curl http://localhost:8000/multiple-requests
   ```

5. Check the traces in Sentry

## Expected Behavior

The `http.client` spans for requests to `httpbin.org/delay/1` should show approximately 1000ms duration, reflecting the actual time spent on the HTTP request.

## Actual Behavior

The `http.client` spans show impossibly short times (< 1ms) that don't reflect the real I/O time spent on the request.

## Environment

- Python: 3.9+
- sentry-sdk: 2.49.0+
- fastapi: 0.115.0+
- requests: 2.32.0+
