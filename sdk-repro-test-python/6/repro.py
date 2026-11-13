"""Reproduction for getsentry/sdk-repro-test-python#6.

`set_user` with a field set to None should leave that field out of the user
attributes on logs. Instead the SDK sends the literal string "None".
Exits 1 when the bug reproduces, 0 when it is fixed. Sends nothing.
"""

import sys

import sentry_sdk
from sentry_sdk.transport import Transport

envelopes = []


class CaptureTransport(Transport):
    def capture_envelope(self, envelope):
        envelopes.append(envelope)


sentry_sdk.init(
    dsn="https://public@example.com/1",
    transport=CaptureTransport(),
    enable_logs=True,
    send_default_pii=True,
)

# username is None: expected to be left out of the log attributes.
sentry_sdk.set_user({"email": "ada@example.com", "username": None})
sentry_sdk.logger.info("hello")
sentry_sdk.flush()

user_attrs = {}
for envelope in envelopes:
    for item in envelope.items:
        if item.headers.get("type") == "log":
            for log in item.payload.json["items"]:
                user_attrs.update(
                    {k: v for k, v in log["attributes"].items() if k.startswith("user.")}
                )

print("sentry-sdk", sentry_sdk.VERSION, "loaded from", sentry_sdk.__file__)
print("user attributes on the log:", user_attrs)

if "user.email" not in user_attrs:
    print("UNEXPECTED: no user.email attribute on the log, cannot check the bug")
    sys.exit(2)

none_strings = {k: v for k, v in user_attrs.items() if v.get("value") == "None"}
if none_strings:
    print('BUG REPRODUCED: None user fields sent as the string "None":', none_strings)
    sys.exit(1)

print("OK: None user fields are left out")
