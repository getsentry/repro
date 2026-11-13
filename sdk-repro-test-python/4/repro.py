"""Reproduction for getsentry/sdk-repro-test-python#4.

`capture_checkin` returns a check-in id even when the SDK sent nothing.
Expected: `None`, like `sentry_sdk.capture_event` returns when nothing is sent.
Actual: a 32-character hex check-in id.

Nothing is sent over the network: the DSN is a dummy and the transport only
records envelopes in memory.
"""

import sys

import sentry_sdk
from sentry_sdk.crons import capture_checkin
from sentry_sdk.transport import Transport

print("sentry-sdk", sentry_sdk.VERSION, "from", sentry_sdk.__file__)


class MemoryTransport(Transport):
    def __init__(self, options=None):
        super().__init__(options)
        self.envelopes = []

    def capture_envelope(self, envelope):
        self.envelopes.append(envelope)


failures = []

# Case 1: no sentry_sdk.init(), so there is no active client.
event_id = sentry_sdk.capture_event({"message": "hello"})
check_in_id = capture_checkin(monitor_slug="nightly", status="in_progress")
print(f"[no client] capture_event -> {event_id!r}, capture_checkin -> {check_in_id!r}")
if check_in_id is not None:
    failures.append("no client: capture_checkin returned an id, but nothing was sent")

# Case 2: active client, but before_send drops the check-in.
transport = MemoryTransport()
sentry_sdk.init(
    dsn="https://public@example.com/1",
    transport=transport,
    before_send=lambda event, hint: None,
)
event_id = sentry_sdk.capture_event({"message": "hello"})
check_in_id = capture_checkin(monitor_slug="nightly", status="in_progress")
print(
    f"[before_send drops] capture_event -> {event_id!r}, capture_checkin -> {check_in_id!r}, "
    f"envelopes sent: {len(transport.envelopes)}"
)
if check_in_id is not None and not transport.envelopes:
    failures.append(
        "before_send dropped the check-in: capture_checkin returned an id, but nothing was sent"
    )

if failures:
    print("BUG REPRODUCED:")
    for f in failures:
        print(" -", f)
    sys.exit(1)

print("OK: capture_checkin returned None whenever nothing was sent")
