"""Reproduction for getsentry/sdk-repro-test-python#5.

With default scrubbing, a "password" field in a JSON request body should be
replaced with "[Filtered]". That works for a JSON object body, but not when the
body is a JSON array of objects: the password is sent in clear text.
Exits 1 when the bug reproduces, 0 when it is fixed. Sends nothing.
"""

import logging
import sys

import sentry_sdk
from flask import Flask
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.transport import Transport

events = []


class CaptureTransport(Transport):
    def capture_envelope(self, envelope):
        for item in envelope.items:
            if item.headers.get("type") == "event":
                events.append(item.payload.json)


sentry_sdk.init(
    dsn="https://public@example.com/1",
    integrations=[FlaskIntegration()],
    transport=CaptureTransport(),
)

app = Flask(__name__)
app.logger.disabled = True
logging.getLogger("werkzeug").disabled = True


@app.route("/single", methods=["POST"])
@app.route("/bulk", methods=["POST"])
def fail():
    raise ValueError("boom")


client = app.test_client()
# Control: a single JSON object body (scrubbed correctly).
client.post("/single", json={"user": "a", "password": "hunter2"})
# Bug: a JSON array body with the same fields (not scrubbed).
client.post("/bulk", json=[{"user": "a", "password": "hunter2"}])
sentry_sdk.flush()

single, bulk = (event["request"]["data"] for event in events)
print("sentry-sdk:", sentry_sdk.VERSION)
print("object body:", single)
print("array body: ", bulk)

if "hunter2" in repr(bulk):
    print("BUG REPRODUCED: password in a JSON array body was not scrubbed")
    sys.exit(1)

print("OK: password in a JSON array body was scrubbed")
