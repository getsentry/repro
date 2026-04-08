"""
Reproduction for getsentry/sentry-python#5955

Demonstrates that Sentry reports request URLs as http:// instead of https://
when Django is behind a reverse proxy with SSL termination, even though
Django's request.scheme correctly returns "https" via SECURE_PROXY_SSL_HEADER.
"""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")

import django

django.setup()

import sentry_sdk

# Collect captured events in memory instead of sending to Sentry
captured_events = []


def capture_transport(event):
    captured_events.append(event)


sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", "https://examplePublicKey@o0.ingest.sentry.io/0"),
    traces_sample_rate=1.0,
    # Use a custom transport to capture events locally for inspection
    transport=capture_transport,
)

from django.test import RequestFactory
from django.core.handlers.wsgi import WSGIHandler

# Create a WSGI handler (this is what Sentry instruments)
handler = WSGIHandler()

# Build a WSGI environ that simulates a request behind a reverse proxy
factory = RequestFactory()

# First, show that Django correctly interprets the scheme
request = factory.get(
    "/debug/",
    HTTP_X_FORWARDED_PROTO="https",
    HTTP_HOST="example.com",
)

print("=== Django Request Object ===")
print(f"  request.scheme: {request.scheme}")
print(f"  request.is_secure(): {request.is_secure()}")
print(f"  X-Forwarded-Proto header: {request.META.get('HTTP_X_FORWARDED_PROTO')}")
print(f"  wsgi.url_scheme in environ: {request.META.get('wsgi.url_scheme')}")
print()

# Now trigger an error through the full WSGI handler to see what Sentry captures
# Build a raw WSGI environ simulating a reverse proxy
environ = {
    "REQUEST_METHOD": "GET",
    "PATH_INFO": "/error/",
    "SERVER_NAME": "internal-app-server",
    "SERVER_PORT": "80",
    "HTTP_HOST": "example.com",
    "HTTP_X_FORWARDED_PROTO": "https",
    "HTTP_X_FORWARDED_HOST": "example.com",
    "wsgi.url_scheme": "http",  # The proxy->app connection is plain HTTP
    "wsgi.input": __import__("io").BytesIO(b""),
    "wsgi.errors": __import__("sys").stderr,
    "SCRIPT_NAME": "",
    "QUERY_STRING": "",
    "CONTENT_TYPE": "",
    "CONTENT_LENGTH": "0",
}

# Process the request through the full Django WSGI handler
# Sentry's middleware wraps this and captures the error
response_started = []


def start_response(status, headers):
    response_started.append(status)


try:
    response = handler(environ, start_response)
    # Consume the response to ensure all middleware runs
    list(response)
except Exception:
    pass

# Check what Sentry captured
print("=== Sentry Captured Event ===")
if captured_events:
    event = captured_events[0]
    request_data = event.get("request", {})
    captured_url = request_data.get("url", "N/A")

    print(f"  Captured URL: {captured_url}")
    print(f"  URL starts with https: {captured_url.startswith('https://')}")
    print(f"  wsgi.url_scheme in environ: {environ.get('wsgi.url_scheme')}")
    print()

    # Show the mismatch
    print("=== BUG DEMONSTRATION ===")
    print(f"  Django request.scheme says: https")
    print(f"  Sentry captured URL scheme:  {'https' if captured_url.startswith('https://') else 'http'}")
    print()

    if not captured_url.startswith("https://"):
        print("  BUG CONFIRMED: Sentry reports http:// even though Django resolves")
        print("  the scheme as https via SECURE_PROXY_SSL_HEADER.")
        print()
        print("  Root cause: Sentry reads wsgi.url_scheme directly from the WSGI")
        print("  environ instead of using Django's request.scheme property, which")
        print("  respects the SECURE_PROXY_SSL_HEADER setting.")
    else:
        print("  Bug NOT reproduced - Sentry correctly reports https://")
else:
    print("  No events captured by Sentry")
    print("  (This might mean the error was not captured - check for errors above)")
