"""Reproduction for getsentry/sdk-repro-test-python#28.

A backend with only `traces_sample_rate` continues a sampled trace whose
baggage says `sentry-sample_rate=0.01`. The SDK should pass the incoming
sample rate on unchanged, in both the outgoing baggage and the trace header
(dynamic sampling context) of the transaction it sends.

Bug: both say `sample_rate=1.0` instead of `0.01`.

Exits 1 when the bug reproduces, 0 otherwise. Uses a dummy DSN and an
in-memory transport, so nothing is sent.
"""

import sys

import sentry_sdk
from sentry_sdk.transport import Transport

INCOMING_SAMPLE_RATE = "0.01"


class MemoryTransport(Transport):
    def __init__(self, options=None):
        super().__init__(options)
        self.envelopes = []

    def capture_envelope(self, envelope):
        self.envelopes.append(envelope)


transport = MemoryTransport()
sentry_sdk.init(
    dsn="https://public@example.com/1",
    transport=transport,
    traces_sample_rate=0.5,
)

headers = {
    "sentry-trace": "771a43a4192642f0b136d5159a501700-1234567890abcdef-1",
    "baggage": "sentry-trace_id=771a43a4192642f0b136d5159a501700,"
    f"sentry-sample_rate={INCOMING_SAMPLE_RATE},"
    "sentry-sample_rand=0.005,sentry-sampled=true,sentry-public_key=public",
}

tx = sentry_sdk.continue_trace(headers, name="t", op="http.server")
with sentry_sdk.start_transaction(tx):
    outgoing_baggage = sentry_sdk.get_baggage()

sentry_sdk.flush()

trace_header = None
for envelope in transport.envelopes:
    if envelope.get_transaction_event() is not None:
        trace_header = envelope.headers.get("trace") or {}

print("sentry-sdk version:", sentry_sdk.VERSION)
print("incoming sample_rate:", INCOMING_SAMPLE_RATE)
print("outgoing baggage:", outgoing_baggage)
print("transaction envelope trace header:", trace_header)

baggage_rate = None
for item in (outgoing_baggage or "").split(","):
    key, _, value = item.partition("=")
    if key.strip() == "sentry-sample_rate":
        baggage_rate = value.strip()

header_rate = (trace_header or {}).get("sample_rate")

problems = []
if baggage_rate != INCOMING_SAMPLE_RATE:
    problems.append(f"baggage sample_rate is {baggage_rate!r}")
if header_rate != INCOMING_SAMPLE_RATE:
    problems.append(f"trace header sample_rate is {header_rate!r}")

if problems:
    print(
        f"BUG REPRODUCED: expected sample_rate={INCOMING_SAMPLE_RATE}, but "
        + "; ".join(problems)
    )
    sys.exit(1)

print("OK: incoming sample_rate was passed on unchanged")
