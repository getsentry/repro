# Reproduction for getsentry/sdk-repro-test-python#3
#
# With enable_logs=True, one log whose attribute is NaN (or inf) makes the
# whole log batch disappear. No error is printed.
#
# Expected: every batch delivers all 11 logs (or at least the 10 normal ones).
# Actual:   the batch with a NaN inside a list attribute delivers 0 of 11.
#
# A local HTTP server on 127.0.0.1 acts as the DSN and counts the log items it
# receives. Nothing leaves the machine.
import gzip
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import sentry_sdk

received = []


class Sink(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        if self.headers.get("Content-Encoding") == "gzip":
            body = gzip.decompress(body)
        for line in body.split(b"\n")[1:]:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if isinstance(d, dict) and "items" in d:
                received.append(len(d["items"]))
        self.send_response(200)
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"{}")


srv = HTTPServer(("127.0.0.1", 0), Sink)
threading.Thread(target=srv.serve_forever, daemon=True).start()
sentry_sdk.init(
    dsn="http://key@127.0.0.1:%d/1" % srv.server_port,
    enable_logs=True,
)
print(f"sentry-sdk {sentry_sdk.VERSION}")

# Each case sends 10 normal logs plus one log with a NaN/inf attribute, in
# one batch. The issue's snippet is the first case.
cases = [
    ("scalar nan", lambda: sentry_sdk.logger.info("loss is {loss}", loss=float("nan"))),
    ("scalar inf", lambda: sentry_sdk.logger.info("loss is {loss}", loss=float("inf"))),
    (
        "nan in list attribute",
        lambda: sentry_sdk.logger.info("losses", attributes={"losses": [0.5, float("nan")]}),
    ),
    ("control: 0.5", lambda: sentry_sdk.logger.info("loss is {loss}", loss=0.5)),
]

failed = []
for name, send_special in cases:
    received.clear()
    for i in range(10):
        sentry_sdk.logger.info("log %d" % i)
    send_special()
    sentry_sdk.flush()
    delivered = sum(received)
    print(f"{name}: delivered {delivered} of 11")
    if delivered < 10:
        failed.append(name)

if failed:
    print("BUG REPRODUCED: a NaN/inf log attribute dropped the whole batch:", ", ".join(failed))
    sys.exit(1)

print("OK: all batches delivered")
