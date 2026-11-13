"""Reproduction for getsentry/sdk-repro-test-python#9.

Falcon 3+ allows `resp.status` to be an int. When an error handler sets an
int status and the Sentry Falcon integration is enabled, the request should
still return 404. Instead it crashes with
`AttributeError: 'int' object has no attribute 'startswith'`.
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
    resp.status = 404  # int status, valid in Falcon 3+
    resp.text = "Not found"


sentry_sdk.init(
    dsn="https://public@example.com/1",
    integrations=[FalconIntegration()],
    before_send=lambda event, hint: None,  # send nothing
)

print(f"falcon {falcon.__version__}, sentry-sdk {sentry_sdk.VERSION}")

app = falcon.App()
app.add_route("/", Resource())
app.add_error_handler(LookupError, handle_missing_item)

try:
    status_code = falcon.testing.TestClient(app).simulate_get("/").status_code
except Exception:
    print("BUG: request crashed instead of returning 404:")
    traceback.print_exc()
    sys.exit(1)

print(f"status code: {status_code}")
if status_code != 404:
    print("BUG: expected 404")
    sys.exit(1)
print("OK: got 404 as expected")
