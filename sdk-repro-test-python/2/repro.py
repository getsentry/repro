# Reproduction for getsentry/sdk-repro-test-python#2
#
# Baggage.serialize(include_third_party=True) adds a trailing comma when the
# incoming baggage header has only sentry- entries (no third-party items).
#
# Expected: the serialized header has no trailing comma.
# Actual:   it ends with "," which strict W3C baggage parsers reject.
import sys

import sentry_sdk
from sentry_sdk.tracing_utils import Baggage

print(f"sentry-sdk {sentry_sdk.VERSION}")

incoming = "sentry-trace_id=771a43a4192642f0b136d5159a501700,sentry-sample_rate=0.5"
baggage = Baggage.from_incoming_header(incoming)
serialized = baggage.serialize(include_third_party=True)
print(f"serialized: {serialized!r}")

# Control case: with a third-party entry, output is fine.
with_vendor = Baggage.from_incoming_header(incoming + ",other-vendor=foo")
print(f"with third-party: {with_vendor.serialize(include_third_party=True)!r}")

if serialized.endswith(","):
    print("BUG REPRODUCED: serialized baggage ends with a trailing comma")
    sys.exit(1)

print("OK: no trailing comma")
