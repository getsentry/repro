"""
Reproduction for getsentry/sdk-repro-test-python#25

When a client sends the `sentry-trace` header twice, many server frameworks
join the repeated headers into one comma-separated value. `continue_trace`
should continue the trace from the first value. Instead, the SDK starts a new
trace, so the incoming trace is split.

Exits non-zero when the bug reproduces.
"""

import sys

import sentry_sdk
from sentry_sdk.transport import Transport

TRACE_ID = "efa64e95faf54da59b81cce3fb159825"
FIRST_SPAN_ID = "b8efba9273e7a14f"
SECOND_SPAN_ID = "b8ffba9273e7a14f"


class NoopTransport(Transport):
    # Send nothing; we only care about the transaction the SDK builds.
    def capture_envelope(self, envelope):
        pass


sentry_sdk.init(
    dsn="https://public@example.com/1",
    transport=NoopTransport(),
    traces_sample_rate=1.0,
)

print(f"sentry-sdk {sentry_sdk.VERSION}")

# Control: a single header continues the trace as expected.
single = sentry_sdk.continue_trace(
    {"sentry-trace": f"{TRACE_ID}-{FIRST_SPAN_ID}-1"},
    op="http.server",
    name="single",
)
print(f"single header:     trace_id={single.trace_id} parent_span_id={single.parent_span_id}")

# Bug: the same header sent twice and joined with a comma.
joined = sentry_sdk.continue_trace(
    {
        "sentry-trace": f"{TRACE_ID}-{FIRST_SPAN_ID}-1,"
        f"{TRACE_ID}-{SECOND_SPAN_ID}-1"
    },
    op="http.server",
    name="joined",
)
print(f"joined headers:    trace_id={joined.trace_id} parent_span_id={joined.parent_span_id}")
print(f"expected (joined): trace_id={TRACE_ID} parent_span_id={FIRST_SPAN_ID}")

if single.trace_id != TRACE_ID or single.parent_span_id != FIRST_SPAN_ID:
    print("\nUNEXPECTED: even a single sentry-trace header was not continued.")
    sys.exit(2)

if joined.trace_id != TRACE_ID or joined.parent_span_id != FIRST_SPAN_ID:
    print("\nBUG REPRODUCED: the comma-joined sentry-trace header started a new trace.")
    sys.exit(1)

print("\nNot reproduced: the trace was continued from the first header.")
