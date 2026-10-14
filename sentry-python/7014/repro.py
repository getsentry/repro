"""
Reproduction for getsentry/sentry-python#7014

On CPython < 3.12, `sys.settrace()` is guarded by ONE process-wide `reentrant`
flag that stays set while audit hooks run (python/cpython#98257). filelock
3.30.0 - 4.0.2 registers a Python-level audit hook at import time. When a
tracer is installed for all threads (coverage/pytest-cov does
`threading.settrace(...)`), every new thread calls `sys.settrace()` from
`Thread._bootstrap_inner()`. If the GIL switches to another thread while the
first one is inside filelock's audit hook, the second thread's `settrace()`
raises:

    RuntimeError: Cannot install a trace function while another trace function
    is being installed

The thread dies before running its target. For a fresh ThreadPoolExecutor
that means the submitted work item never runs. LiteLLM finishes Sentry's
`gen_ai.chat` span in a success callback submitted to such an executor, so
the span is silently lost -> `assert len(chat_spans) == 1` fails with 0.

Expected: every submitted callback runs, every transaction has its child span.
Actual (py3.10 + filelock<4.0.3 + tracer): some callbacks never run and the
span is missing; the worker thread dies with the RuntimeError above.
"""

import argparse
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import sentry_sdk
from sentry_sdk.transport import Transport


class MemoryTransport(Transport):
    """Keep envelopes in memory so no DSN / network is needed."""

    def __init__(self, options=None):
        super().__init__(options)
        self.chat_spans = 0

    def capture_envelope(self, envelope):
        for item in envelope.items:
            payload = item.payload.json or {}
            if item.type == "transaction":
                spans = payload.get("spans", [])
                self.chat_spans += sum(1 for s in spans if s.get("op") == "gen_ai.chat")
            elif item.type == "span":
                for s in payload.get("items", []):
                    op = s.get("attributes", {}).get("sentry.op", {}).get("value")
                    self.chat_spans += op == "gen_ai.chat"


def tracer(frame, event, arg):
    # Stand-in for coverage's per-thread tracer.
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=5000)
    parser.add_argument("--burst", type=int, default=16, help="executors started concurrently per iteration")
    parser.add_argument("--no-filelock", action="store_true", help="control: don't import filelock")
    parser.add_argument("--no-tracer", action="store_true", help="control: don't install a thread tracer")
    args = parser.parse_args()

    if not args.no_filelock:
        import filelock  # registers sys.addaudithook() on import (3.30.0 - 4.0.2)

        print(f"filelock {filelock.__version__}")
    if not args.no_tracer:
        threading.settrace(tracer)  # what coverage / pytest-cov does

    # Make GIL hand-offs (and therefore the race) more frequent.
    sys.setswitchinterval(1e-6)

    transport = MemoryTransport()
    sentry_sdk.init(transport=transport, traces_sample_rate=1.0)

    dead_threads = []
    sys.unraisablehook = lambda u: dead_threads.append(u.exc_value)

    started = time.monotonic()
    lost = 0
    for i in range(args.iterations):
        with sentry_sdk.start_transaction(name=f"txn-{i}"):
            pending = []
            for _ in range(args.burst):
                span = sentry_sdk.start_span(op="gen_ai.chat", name="chat")
                # Fresh executor, like the litellm tests' `reset_litellm_executor`.
                executor = ThreadPoolExecutor(max_workers=1)
                # LiteLLM finishes the gen_ai.chat span in a success callback run in a thread pool.
                executor.submit(span.finish)
                pending.append((span, executor))
            for span, executor in pending:
                executor.shutdown(wait=True)  # the tests do exactly this before asserting
                if span.timestamp is None:
                    lost += 1  # the callback never ran

    sentry_sdk.flush()
    total = args.iterations * args.burst

    print(f"python {sys.version.split()[0]}, executors={total}, {time.monotonic() - started:.1f}s")
    print(f"worker threads that died in Thread._bootstrap: {len(dead_threads)}")
    if dead_threads:
        print(f"  e.g. {dead_threads[0]!r}")
    print(f"callbacks that never ran (span never finished): {lost}")
    print(f"gen_ai.chat spans received by transport: {transport.chat_spans}/{total}")
    if lost or dead_threads:
        print("BUG REPRODUCED")
        sys.exit(1)
    print("OK: every callback ran")


if __name__ == "__main__":
    main()
