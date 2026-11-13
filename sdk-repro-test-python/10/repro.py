# Reproduction for getsentry/sdk-repro-test-python#10
#
# The backend uses traces_sample_rate=0.5 (no traces_sampler) and continues a
# sampled trace whose incoming baggage says sentry-sample_rate=0.01.
#
# Expected: the outgoing baggage and the transaction's trace header keep
#           sample_rate=0.01, the incoming value, unchanged.
# Actual:   both say sample_rate=1.0.
import sys

import sentry_sdk
from sentry_sdk.transport import Transport

envelopes = []


class InMemory(Transport):
    def capture_envelope(self, envelope):
        envelopes.append(envelope)


print(f"sentry-sdk {sentry_sdk.VERSION}")

sentry_sdk.init(
    dsn="https://public@example.com/1",
    transport=InMemory(),
    traces_sample_rate=0.5,
)

headers = {
    "sentry-trace": "771a43a4192642f0b136d5159a501700-1234567890abcdef-1",
    "baggage": "sentry-trace_id=771a43a4192642f0b136d5159a501700,sentry-sample_rate=0.01,"
    "sentry-sample_rand=0.005,sentry-sampled=true,sentry-public_key=abc",
}

tx = sentry_sdk.continue_trace(headers, name="t", op="http.server")
with sentry_sdk.start_transaction(tx):
    baggage = sentry_sdk.get_baggage()
sentry_sdk.flush()

print(f"outgoing baggage: {baggage}")

trace_header_rate = None
for envelope in envelopes:
    if envelope.items and envelope.items[0].type == "transaction":
        trace_header_rate = (envelope.headers.get("trace") or {}).get("sample_rate")
print(f"transaction envelope trace header sample_rate: {trace_header_rate!r}")

baggage_rate = None
for item in (baggage or "").split(","):
    key, _, value = item.partition("=")
    if key.strip() == "sentry-sample_rate":
        baggage_rate = value.strip()

if baggage_rate != "0.01" or trace_header_rate != "0.01":
    print(
        "BUG REPRODUCED: expected sample_rate=0.01 (incoming), "
        f"got baggage={baggage_rate!r}, trace header={trace_header_rate!r}"
    )
    sys.exit(1)

print("OK: incoming sample_rate passed on unchanged")
