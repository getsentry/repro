# Reproduction for sentry-ruby#2963

**Reference:** https://github.com/getsentry/sentry-ruby/issues/2963

## Description

Memory leak and deadlock (`deadlock; recursive locking`) when both `enable_logs` and `enable_metrics` are enabled, and an HTTP instrumentation library (e.g. Yabeda) re-enters `Sentry.metrics` during transport send.

The root cause is a re-entrancy bug in `TelemetryEventBuffer`. The call chain is:

```
MetricEventBuffer#flush → @mutex.synchronize → send_items
  → HTTPTransport#send_data → Net::HTTP POST
    → Yabeda HTTP instrumentation fires
      → Sentry.metrics.count(...)
        → MetricEventBuffer#add_item → @mutex.synchronize → DEADLOCK
```

Ruby's `Mutex` is non-reentrant, so the same thread trying to lock the mutex it already holds raises `ThreadError: deadlock; recursive locking`.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

2. Run the reproduction:
   ```bash
   bundle exec ruby repro.rb
   ```

## Expected Behavior

Metrics should be sent without deadlocking, even when instrumentation on outgoing HTTP calls re-enters the metrics API.

## Actual Behavior

```
E, [...] ERROR -- sentry: ** [Sentry] Envelope sending failed: deadlock; recursive locking
E, [...] ERROR -- sentry: ** [Sentry] [Sentry::MetricEventBuffer] Failed to send Sentry::MetricEvent: deadlock; recursive locking
```

The deadlock causes metrics to be silently dropped on every flush cycle. Failed flushes accumulate buffered events, leading to steady memory growth.

## Reproduction Evidence

The script simulates Yabeda's behavior by having the transport call `Sentry.metrics.count()` during `send_data`, which re-enters `MetricEventBuffer#add_item` while the flush already holds the mutex.

## Environment

- Ruby: 3.3.6 (issue reported on 4.0.5 +YJIT)
- SDK: sentry-ruby 6.6.0
- Framework: standalone (issue observed with Rails 8 + Puma + Yabeda)
