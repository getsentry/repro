"""Reproduction for getsentry/sdk-repro-test-python#7.

When the `sentry-trace` header arrives twice and the server framework joins the
values into one comma-separated string, `continue_trace` should continue the
trace from the first value. Instead it starts a new trace.
"""

import sys

import sentry_sdk
from sentry_sdk.transport import Transport


class Noop(Transport):
    def capture_envelope(self, envelope):
        pass


sentry_sdk.init(
    dsn="https://public@example.com/1",
    transport=Noop(),
    traces_sample_rate=1.0,
)

EXPECTED_TRACE_ID = "efa64e95faf54da59b81cce3fb159825"
EXPECTED_PARENT_SPAN_ID = "b8efba9273e7a14f"

headers = {
    # Two sentry-trace values joined with a comma, as frameworks do for
    # repeated headers.
    "sentry-trace": "efa64e95faf54da59b81cce3fb159825-b8efba9273e7a14f-1,"
    "efa64e95faf54da59b81cce3fb159825-b8ffba9273e7a14f-1"
}

tx = sentry_sdk.continue_trace(headers, op="http.server", name="t")

print("sentry-sdk version:", sentry_sdk.VERSION)
print("sentry-sdk loaded from:", sentry_sdk.__file__)
print("trace_id:      ", tx.trace_id, "(expected", EXPECTED_TRACE_ID + ")")
print("parent_span_id:", tx.parent_span_id, "(expected", EXPECTED_PARENT_SPAN_ID + ")")

if tx.trace_id != EXPECTED_TRACE_ID or tx.parent_span_id != EXPECTED_PARENT_SPAN_ID:
    print("BUG REPRODUCED: the incoming trace was not continued")
    sys.exit(1)

print("OK: the incoming trace was continued")
