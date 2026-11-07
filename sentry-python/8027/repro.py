"""
Reproduction for getsentry/sentry-python#8027: span streaming sends the span envelopes of different traces
out of order (sentry-python Django cache test flake).

With `trace_lifecycle="stream"`, every finished segment adds its trace_id to
`SpanBatcher._pending_flush`. That attribute is a `set`. When the background
flusher wakes up after two or more segments have finished, it does
`buckets = list(self._pending_flush)`, so the traces are sent in hash order
of their trace_ids instead of the order the segments finished.

`tests/integrations/django/test_cache_module.py::test_cache_spans_item_size[True]`
(and `test_cache_spans_decorator[True]`) make two requests, one trace each, and
index the captured spans by position. When the flusher picks up both traces
in one pass, request 2's `cache.get` (a hit) can come first, which fails with
`assert not spans[0]["attributes"]["cache.hit"]`.

Expected: segments that finished in order 1, 2 are sent in order 1, 2.
Actual: when both are pending at once, the order is random (about 50%).

Modes:
  default            natural timing. Both segments here finish within one GIL
                     switch interval, so the flusher usually sees both pending
                     and the order is a coin flip. In the Django test the
                     requests are slower, so the flusher usually drains
                     request 1 first, and the flake only appears when a busy
                     CI runner delays the flusher thread.
  --delay-flusher    keep the GIL away from the flusher until both segments
                     are pending (sys.setswitchinterval), which forces the
                     "both pending" case
"""

import argparse
import sys
import time

import sentry_sdk
from sentry_sdk.transport import Transport


class MemoryTransport(Transport):
    """Record the trace_id of each span envelope in send order. No DSN needed."""

    def __init__(self, options=None):
        super().__init__(options)
        self.sent_trace_ids = []

    def capture_envelope(self, envelope):
        for item in envelope.items:
            if item.type == "span":
                self.sent_trace_ids.append(item.payload.json["items"][0]["trace_id"])


def one_iteration(pause):
    transport = MemoryTransport()
    sentry_sdk.init(transport=transport, traces_sample_rate=1.0, trace_lifecycle="stream")

    finished = []
    for name in ("request-1", "request-2"):
        sentry_sdk.traces.new_trace()  # one trace per request, like the Django integration
        with sentry_sdk.traces.start_span(name=name) as segment:
            with sentry_sdk.traces.start_span(name="cache.get"):
                pass
        finished.append(segment.trace_id)

    # Like the test client finishing the response before the test calls flush().
    # Sleeping releases the GIL, so the flusher thread can drain _pending_flush.
    time.sleep(pause)
    sentry_sdk.flush()
    sentry_sdk.get_client().close()

    sent = list(dict.fromkeys(transport.sent_trace_ids))
    return sent == finished


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=500)
    parser.add_argument("--delay-flusher", action="store_true")
    parser.add_argument("--pause", type=float, default=0.005)
    args = parser.parse_args()

    if args.delay_flusher:
        # The main thread keeps the GIL until it blocks, so the flusher only
        # runs after both segments have finished.
        sys.setswitchinterval(1.0)

    out_of_order = sum(not one_iteration(args.pause) for _ in range(args.iterations))
    print(
        f"python {sys.version.split()[0]}, sentry-sdk {sentry_sdk.VERSION}, "
        f"delay_flusher={args.delay_flusher}, iterations={args.iterations}"
    )
    print(f"iterations where request-2's spans were sent before request-1's: {out_of_order}")
    if out_of_order:
        print("BUG REPRODUCED")
        sys.exit(1)
    print("OK: span envelopes sent in segment-finish order")


if __name__ == "__main__":
    main()
