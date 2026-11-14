"""
Reproduction for getsentry/sdk-repro-test-python#21

A single log with a NaN (or inf) attribute makes the whole log batch fail to
serialize, so none of the logs in that batch are sent. No error is shown.

The real HttpTransport is used, but `_send_request` is overridden to record
the request body instead of sending it, so nothing leaves the machine.

Exits 1 while the bug is present, 0 once it is fixed.
"""

import gzip
import json
import sys

import sentry_sdk
from sentry_sdk.transport import HttpTransport

DSN = "https://public@example.com/1"
NORMAL_LOGS = 10

delivered_logs = []


class RecordingTransport(HttpTransport):
    def _send_request(self, body, headers, endpoint_type, envelope=None):
        if headers.get("Content-Encoding") == "gzip":
            body = gzip.decompress(body)
        for line in body.split(b"\n")[1:]:
            try:
                payload = json.loads(line)
            except ValueError:
                continue
            if isinstance(payload, dict) and "items" in payload:
                delivered_logs.extend(payload["items"])


def main():
    sentry_sdk.init(
        dsn=DSN,
        enable_logs=True,
        transport=RecordingTransport,
    )
    print("sentry-sdk", sentry_sdk.VERSION, "from", sentry_sdk.__file__)

    for i in range(NORMAL_LOGS):
        sentry_sdk.logger.info("log %d" % i)
    # Expected: this log is sent too (or at least it does not take the other
    # 10 logs down with it). Actual: the batch fails to serialize and nothing
    # is sent.
    sentry_sdk.logger.info("loss is {loss}", loss=float("nan"))
    sentry_sdk.flush()

    total = NORMAL_LOGS + 1
    print("delivered %d of %d logs" % (len(delivered_logs), total))

    if len(delivered_logs) < NORMAL_LOGS:
        print("BUG REPRODUCED: one NaN attribute dropped the whole log batch")
        sys.exit(1)

    print("OK: the log batch was sent")
    sys.exit(0)


if __name__ == "__main__":
    main()
