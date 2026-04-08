# Reproduction for sentry-python#5955

**Issue:** https://github.com/getsentry/sentry-python/issues/5955

## Description

Django HTTPS URLs are reported as HTTP in Sentry when the app runs behind a reverse proxy (e.g. AWS ALB) with SSL termination. Even though Django correctly resolves `request.scheme` as `"https"` via `SECURE_PROXY_SSL_HEADER`, Sentry reads `wsgi.url_scheme` directly from the WSGI environ (which is `"http"` since the proxy-to-app connection is plain HTTP).

## Steps to Reproduce

1. Install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Run the reproduction:
   ```bash
   python repro.py
   ```

## Expected Behavior

Sentry should report the request URL as `https://example.com/error/`, since Django resolves the scheme as HTTPS via the `SECURE_PROXY_SSL_HEADER` setting.

## Actual Behavior

Sentry reports the URL as `http://example.com/error/`.

```
=== Django Request Object ===
  request.scheme: https
  request.is_secure(): True
  X-Forwarded-Proto header: https
  wsgi.url_scheme in environ: http

=== Sentry Captured Event ===
  Captured URL: http://example.com/error/
  URL starts with https: False

=== BUG DEMONSTRATION ===
  Django request.scheme says: https
  Sentry captured URL scheme:  http

  BUG CONFIRMED: Sentry reports http:// even though Django resolves
  the scheme as https via SECURE_PROXY_SSL_HEADER.
```

## Root Cause

In `sentry_sdk/integrations/wsgi.py`, the `get_request_url()` function reads `environ.get("wsgi.url_scheme")` directly from the WSGI environ. It does not check the `X-Forwarded-Proto` header or use Django's `request.scheme` property (which respects `SECURE_PROXY_SSL_HEADER`).

## Environment

- Python: 3.12
- sentry-sdk: 2.57.0
- Django: 4.2
