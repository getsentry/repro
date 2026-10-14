# Reproduction for sentry-python#8031

**Issue:** https://github.com/getsentry/sentry-python/issues/8031

## Description

`tests/test_monitor.py::test_segment_uses_downsampled_rate` sometimes fails with `assert 0.25 == 0.5`.

The test sets `monitor.interval = 0.1` and calls `monitor.run()` once by hand, then expects `downsample_factor == 1`. But the first `monitor.is_healthy()` call also starts the monitor's background thread, and that thread calls `run()` every `interval` seconds as well. On a slow runner, more than 0.1 s passes before the sampling decision, so the factor becomes 2 and the sample rate 0.25.

`repro.py` runs the same sequence many times. Between the manual `run()` and the sampling decision it waits a random 0–`--delay-max` seconds, to stand in for a slow CI runner.

## Steps to Reproduce

No DSN is needed; the transport is a stub. To use a real project anyway, run `export SENTRY_DSN=`.

1. Run the reproduction (uv installs `sentry-sdk` from the inline script metadata):
   ```bash
   uv run repro.py --iterations 100
   ```
2. Short gaps (below the 0.1 s interval) don't trigger it:
   ```bash
   uv run repro.py --iterations 100 --delay-max 0.05
   ```
3. Stopping the background thread first, so the health check runs only by hand as the test intends, makes it pass:
   ```bash
   uv run repro.py --iterations 100 --stop-thread
   ```

The script exits with code 1 if any iteration gets an unexpected rate.

## Expected Behavior

After one manual `run()`, the sample rate is `0.5` in every iteration.

## Actual Behavior

With gaps of up to 0.2 s, the rate is `0.25` in about half the iterations:

```
sentry-sdk 2.72.0
unexpected sample rate (expected 0.5) in 55/100 iterations
```

With `--delay-max 0.05` the result was 0/100, and with `--stop-thread` it was 0/100.

## Environment

- Python: 3.12 (any version works)
- sentry-sdk: 2.72.0
- OS: Linux
