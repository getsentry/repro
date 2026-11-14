"""Reproduction for getsentry/sdk-repro-test-python#27.

Falcon 3+ lets an error handler set `resp.status` to an int. With the Sentry
Falcon integration enabled, the integration calls `response.status.startswith`
and the request crashes with AttributeError instead of returning 404.

Exit code 0: the app returns 404 (expected).
Exit code 1: the request crashes or returns another status (bug).
"""

import sys
import traceback

import falcon
import falcon.testing
import sentry_sdk
from sentry_sdk.integrations.falcon import FalconIntegration


class Resource:
    def on_get(self, req, resp):
        raise LookupError("missing item")


def handle_missing_item(req, resp, error, params):
    # Falcon 3+ accepts an int status here.
    resp.status = 404
    resp.text = "Not found"


events = []

# Dummy DSN so the SDK is enabled; events stay in memory and nothing is sent.
sentry_sdk.init(
    dsn="https://public@example.com/1",
    integrations=[FalconIntegration()],
    before_send=lambda event, hint: events.append(event) and None,
)

app = falcon.App()
app.add_route("/", Resource())
app.add_error_handler(LookupError, handle_missing_item)

print(f"falcon {falcon.__version__}, sentry-sdk {sentry_sdk.VERSION}")
print(f"sentry_sdk loaded from {sentry_sdk.__file__}")

try:
    status_code = falcon.testing.TestClient(app).simulate_get("/").status_code
except Exception:
    traceback.print_exc()
    print("BUG REPRODUCED: request crashed instead of returning 404")
    sys.exit(1)

print(f"status code: {status_code}")
if status_code != 404:
    print("BUG REPRODUCED: expected 404")
    sys.exit(1)

print("OK: got 404 as expected")
