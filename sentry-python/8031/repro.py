# /// script
# requires-python = ">=3.9"
# dependencies = ["sentry-sdk"]
# ///
"""Reproduction for getsentry/sentry-python#8031.

Mirrors tests/test_monitor.py::test_segment_uses_downsampled_rate:
an unhealthy transport, monitor.interval = 0.1, one manual monitor.run(),
then a sampling decision. The test expects downsample_factor == 1 and a
sample rate of 0.5.

The monitor's own background thread (started by the first is_healthy() call)
also calls run() every `interval` seconds. If the gap between the first
is_healthy() and the sampling decision is longer than `interval` (a slow or
busy CI runner), the factor is 2 and the sample rate 0.25.

`--delay-max` sets the largest random gap (seconds) inserted between the
manual run() and the sampling decision, to stand in for a slow runner.
"""

import argparse
import os
import random
import time
from unittest import mock

import sentry_sdk
from sentry_sdk.transport import Transport


class UnhealthyTransport(Transport):
    def capture_envelope(self, envelope):
        pass

    def is_healthy(self):
        return False


def one_iteration(delay_max, stop_thread):
    sentry_sdk.init(
        dsn=os.environ.get("SENTRY_DSN") or "https://public@example.com/1",
        traces_sample_rate=1.0,
        transport=UnhealthyTransport(),
    )
    client = sentry_sdk.get_client()
    monitor = client.monitor
    if stop_thread:
        # Drive health checks only by hand, as the test intends.
        monitor.kill()
    monitor.interval = 0.1

    assert monitor.is_healthy() is True  # starts the background thread
    monitor.run()
    factor_after_run = monitor.downsample_factor

    time.sleep(random.uniform(0, delay_max))  # slow runner

    with mock.patch("sentry_sdk.tracing_utils.Random.randrange", return_value=750000):
        with sentry_sdk.start_transaction(name="foobar") as transaction:
            rate = transaction.sample_rate

    client.close()
    return factor_after_run, rate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=100)
    parser.add_argument("--delay-max", type=float, default=0.2)
    parser.add_argument(
        "--stop-thread",
        action="store_true",
        help="kill the monitor's background thread first (the proposed test fix)",
    )
    args = parser.parse_args()

    print("sentry-sdk", sentry_sdk.VERSION)
    bad = 0
    for _ in range(args.iterations):
        factor, rate = one_iteration(args.delay_max, args.stop_thread)
        if factor != 1 or rate != 0.5:
            bad += 1
    print(
        "unexpected sample rate (expected 0.5) in %d/%d iterations" % (bad, args.iterations)
    )
    raise SystemExit(1 if bad else 0)


if __name__ == "__main__":
    main()
