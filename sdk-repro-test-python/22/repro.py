"""Reproduction for getsentry/sdk-repro-test-python#22.

`sentry_sdk.crons.capture_checkin` returns a check-in id even when the SDK
sends nothing. `sentry_sdk.capture_event` returns `None` in the same cases.

Case 1: no active client (no `sentry_sdk.init()`).
Case 2: an active client whose `before_send` drops the check-in.

Expected: `None` in both cases, and the transport receives nothing.
Actual: a check-in id string, while the transport receives nothing.

Exits 1 when the bug reproduces, 0 otherwise. Nothing is sent over the network.
"""

import sys

import sentry_sdk
from sentry_sdk.crons import capture_checkin
from sentry_sdk.transport import Transport

DUMMY_DSN = "https://public@example.com/1"


class InMemoryTransport(Transport):
    def __init__(self, options=None):
        super().__init__(options)
        self.envelopes = []

    def capture_envelope(self, envelope):
        self.envelopes.append(envelope)


print(f"sentry-sdk {sentry_sdk.VERSION} loaded from {sentry_sdk.__file__}")
failures = []

# Case 1: no sentry_sdk.init(), so there is no active client.
result = capture_checkin(monitor_slug="nightly", status="in_progress")
print(f"[no client]      client active: {sentry_sdk.get_client().is_active()}")
print(f"[no client]      capture_checkin returned: {result!r}")
if result is not None:
    failures.append("no client")

# Case 2: active client, but before_send drops every event (check-ins included).
transport = InMemoryTransport()
sentry_sdk.init(
    dsn=DUMMY_DSN,
    transport=transport,
    before_send=lambda event, hint: None,
)
result = capture_checkin(monitor_slug="nightly", status="in_progress")
sentry_sdk.flush()
print(f"[before_send=None] envelopes received by transport: {len(transport.envelopes)}")
print(f"[before_send=None] capture_checkin returned: {result!r}")
if result is not None and not transport.envelopes:
    failures.append("before_send drop")

if failures:
    print(f"BUG REPRODUCED: capture_checkin returned an id although nothing was sent ({', '.join(failures)})")
    sys.exit(1)

print("OK: capture_checkin returned None when nothing was sent")
