"""
Reproduction for sentry-python#5349
https://github.com/getsentry/sentry-python/issues/5349

This reproduces the issue where requests library calls show incorrect/very short
timing (< 1ms) in http.client spans with sentry-sdk 2.x, compared to version 1.45
where it correctly measured the actual HTTP request duration.

Expected: http.client spans should show the actual time spent on HTTP requests
Actual: http.client spans show impossibly short times (< 1ms) that don't reflect
        the real I/O time spent on the request
"""

import os
import requests
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from fastapi import FastAPI

# Initialize Sentry - set SENTRY_DSN environment variable before running
sentry_dsn = os.environ.get("SENTRY_DSN", "")

if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        integrations=[
            FastApiIntegration(middleware_spans=True),
            StarletteIntegration(middleware_spans=True),
        ],
        traces_sample_rate=1.0,
        debug=True,  # Enable debug to see span info in console
    )
    print(f"Sentry initialized with DSN: {sentry_dsn[:20]}...")
else:
    print("WARNING: SENTRY_DSN not set. Set it to see traces in Sentry.")
    print("Run: export SENTRY_DSN=your_dsn_here")

app = FastAPI()


@app.get("/")
def root():
    """
    Root endpoint that makes an external HTTP request using the requests library.

    The http.client span for this request should show the actual time taken
    (typically 100-500ms for a real HTTP request), but with the bug it shows
    impossibly short times like < 1ms.
    """
    # Make a request to a real external API that takes measurable time
    # httpbin.org/delay/1 will delay the response by 1 second
    response = requests.get("https://httpbin.org/delay/1")

    return {
        "message": "Check Sentry traces - the http.client span should show ~1000ms",
        "status_code": response.status_code,
        "external_url": "https://httpbin.org/delay/1",
    }


@app.get("/multiple-requests")
def multiple_requests():
    """
    Endpoint that makes multiple external HTTP requests.

    This makes it easier to see the timing discrepancy - if each request
    to /delay/1 actually takes ~1 second, but spans show < 1ms,
    the bug is confirmed.
    """
    results = []

    # Make 3 requests, each should take ~1 second
    for i in range(3):
        response = requests.get(f"https://httpbin.org/delay/1")
        results.append({
            "request": i + 1,
            "status": response.status_code,
        })

    return {
        "message": "Made 3 requests to httpbin.org/delay/1 - each should show ~1000ms in traces",
        "results": results,
    }


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("Starting FastAPI server for sentry-python#5349 reproduction")
    print("=" * 60)
    print("\nEndpoints:")
    print("  GET /                  - Single request to httpbin.org/delay/1")
    print("  GET /multiple-requests - Three requests to httpbin.org/delay/1")
    print("\nExpected behavior:")
    print("  http.client spans should show ~1000ms (actual request time)")
    print("\nActual behavior (bug):")
    print("  http.client spans show < 1ms (incorrect/impossible timing)")
    print("\n" + "=" * 60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
