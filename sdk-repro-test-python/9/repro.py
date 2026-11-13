"""Reproduction for getsentry/sdk-repro-test-python#9.

Falcon 3+ allows `resp.status` to be an int. When an error handler sets an
int status, the Sentry Falcon integration calls `.startswith()` on it and the
request crashes with AttributeError.

Expected: the request returns 404, as it does without Sentry.
Actual:   AttributeError: 'int' object has no attribute 'startswith'
"""

import sys

import falcon
import falcon.testing
import sentry_sdk
from sentry_sdk.integrations.falcon import FalconIntegration

class Resource:
    def on_get(self, req, resp):
        raise LookupError("missing item")


def handle_missing_item(req, resp, error, params):
    # Falcon 3+ accepts an int here.
    resp.status = 404
    resp.text = "Not found"


sentry_sdk.init(
    dsn="https://public@example.com/1",
    integrations=[FalconIntegration()],
    transport=lambda envelope: None,  # send nothing
)

print(f"sentry-sdk {sentry_sdk.VERSION} from {sentry_sdk.__file__}")
print(f"falcon {falcon.__version__}")

app = falcon.App()
app.add_route("/", Resource())
app.add_error_handler(LookupError, handle_missing_item)

try:
    status_code = falcon.testing.TestClient(app).simulate_get("/").status_code
except Exception as exc:
    print(f"BUG REPRODUCED: request crashed with {type(exc).__name__}: {exc}")
    sys.exit(1)

print(f"status code: {status_code}")
if status_code != 404:
    print("BUG REPRODUCED: expected 404")
    sys.exit(1)

print("OK: got 404 as expected")
