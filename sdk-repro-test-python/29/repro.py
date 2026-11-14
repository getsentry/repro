"""Reproduction for getsentry/sdk-repro-test-python#29.

An ExceptionGroup whose `__context__` chain loops back through one of its own
sub-exceptions makes `capture_exception` blow up with RecursionError, so the
event is never sent.

The loop is built the way Starlette builds it: the group is caught, its single
inner exception is unwrapped and re-raised inside the `except` block. Python
then sets `inner.__context__ = group`, while `group.exceptions == (inner,)`.

Expected: one envelope reaches the transport and the script exits 0.
Actual (bug): RecursionError, no envelope, exit 1.
"""

import sys

import sentry_sdk
from sentry_sdk.transport import Transport

sent = []


class Capture(Transport):
    def capture_envelope(self, envelope):
        sent.append(envelope)


sentry_sdk.init(dsn="https://public@example.com/1", transport=Capture())
print("sentry_sdk", sentry_sdk.VERSION, "from", sentry_sdk.__file__)

try:
    try:
        raise RuntimeError("something")
    except RuntimeError:
        raise ExceptionGroup("nested", [ValueError(654)])
except ExceptionGroup as exc:
    group = exc
    try:
        raise exc.exceptions[0]  # unwrap and re-raise, like Starlette does
    except Exception:
        pass

inner = group.exceptions[0]
print("inner.__context__ is group:", inner.__context__ is group)

try:
    sentry_sdk.capture_exception(group)
except RecursionError as e:
    print("BUG: capture_exception raised RecursionError:", e)
    sys.exit(1)

sentry_sdk.flush()
print("envelopes sent:", len(sent))
if len(sent) != 1:
    print("BUG: expected 1 envelope")
    sys.exit(1)
print("OK")
