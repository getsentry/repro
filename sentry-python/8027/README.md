# Reproduction for sentry-python#8027

**Issue:** https://github.com/getsentry/sentry-python/issues/8027

## Description

`tests/integrations/django/test_cache_module.py::test_cache_spans_item_size[True]` and `::test_cache_spans_decorator[True]` fail now and then on master, but only in streaming mode. They fail with:

```
tests/integrations/django/test_cache_module.py:763: in test_cache_spans_item_size
    assert not spans[0]["attributes"]["cache.hit"]
E   assert not True
```

Each test makes two requests, and each request is its own trace. The test then reads the captured spans by position. When `trace_lifecycle="stream"` is on, every segment that finishes adds its `trace_id` to `SpanBatcher._pending_flush`, and that attribute is a **`set`**. If the background flusher only wakes after both segments have finished, `list(self._pending_flush)` returns the traces in the set's hash order, not the order they finished. Request 2's spans, starting with a cache hit, can then be sent first.

`repro.py` runs the same sequence without Django: two traces, each a segment with one child span, then `sentry_sdk.flush()`. It then compares the order the traces were sent in with the order their segments finished.

## Steps to Reproduce

Requires [uv](https://docs.astral.sh/uv/). No DSN is needed: envelopes go to an in-memory transport. To send to a real project, `export SENTRY_DSN=` and change `sentry_sdk.init`.

1. Run with normal timing:
   ```bash
   uv run --python 3.12 --with sentry-sdk==2.72.0 python repro.py --iterations 500
   ```
2. Force the case where both traces are pending, by keeping the flusher thread off the GIL until both segments have finished:
   ```bash
   uv run --python 3.12 --with sentry-sdk==2.72.0 python repro.py --iterations 500 --delay-flusher
   ```
3. To measure how often it happens:
   ```bash
   for i in $(seq 5); do uv run --python 3.12 --with sentry-sdk==2.72.0 python repro.py --iterations 200 | grep "sent before"; done
   ```

The script exits 1 and prints `BUG REPRODUCED` if any iteration sent the traces out of order.

## Expected Behavior

Segments that finished in the order request 1, then request 2 are sent in that same order.

## Actual Behavior

About half of the iterations send request 2's spans first:

```
python 3.12.15, sentry-sdk 2.72.0, delay_flusher=True, iterations=300
iterations where request-2's spans were sent before request-1's: 146
BUG REPRODUCED
```

Five runs of 200 iterations with normal timing gave 91, 104, 101, 99 and 95 out-of-order iterations (49%). In this script the two segments finish within one GIL switch interval, so the flusher almost always sees both pending at once. In the Django test the requests take longer, so the flusher usually sends request 1 on its own first. There the flake only appears when a busy CI runner delays the flusher thread.

## Environment

- Python: 3.12.15. The flake is not version-specific; CI failures came from Python 3.10, 3.12 and 3.14.
- sentry-sdk: 2.72.0
- OS: Linux x86_64
