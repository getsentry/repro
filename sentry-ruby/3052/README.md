# Reproduction for sentry-ruby#3052

**Issue:** https://github.com/getsentry/sentry-ruby/issues/3052

## Description

This is a minimal EventMachine/em-synchrony setup that replaces Ruby's
`Mutex` with em-synchrony's fiber-aware mutex and then captures an exception
through Sentry's default background worker.

The issue reports that this combination can fail when the
`Concurrent::ThreadPoolExecutor` used by `Sentry::BackgroundWorker` crosses
thread/fiber execution contexts. The reported failure is:

```text
FiberError: attempt to resume a transferring fiber
em-synchrony (1.0.6) lib/em-synchrony/thread.rb:56:in `resume'
em-synchrony (1.0.6) lib/em-synchrony/thread.rb:56:in `block in unlock'
```

The reproduction uses Sentry's default HTTP transport and requires a real
`SENTRY_DSN`. A test event is queued behind a small background-worker barrier;
the barrier only makes the executor interleaving deterministic and does not
replace or wrap the transport.

## Steps to Reproduce

1. Install dependencies:

   ```bash
   bundle install
   ```

2. Run with the default background worker enabled, supplying a real DSN:

   ```bash
   SENTRY_DSN='https://public@example.com/1' bundle exec ruby repro.rb
   ```

3. Compare with the documented workaround, which uses Sentry's
   `ImmediateExecutor` instead of `Concurrent::ThreadPoolExecutor`:

   ```bash
   SENTRY_DSN='https://public@example.com/1' SENTRY_BACKGROUND_THREADS=0 bundle exec ruby repro.rb
   ```

On the default-worker run, the script should print `FiberError` stack traces
from `em-synchrony` after `Forcing the worker/thread and EventMachine/fiber
interleaving...`. The Sentry event is queued behind the barrier and should not
be processed after the worker fails. The synchronous-worker comparison should
complete without the worker-thread/fiber error.

Use a test project/DSN because the script sends a real event when the default
worker can reach the configured Sentry endpoint.

## Expected Behavior

`Sentry.capture_exception` should dispatch the event through the background
worker without raising or logging a `FiberError`.

## Actual Behavior

The background worker's executor uses the fiber-aware mutex from an
incompatible thread/fiber context. When the barrier is released while the
EventMachine fiber holds the executor lock, the worker's executor bookkeeping
calls em-synchrony's `Mutex#unlock`, which schedules an invalid fiber resume.
This produces `FiberError` and can prevent the queued Sentry event from being
sent.

Set `SENTRY_BACKGROUND_THREADS=0` to compare the workaround described in the
issue. For EventMachine applications that cannot block the reactor, a real
application should additionally use an EventMachine-cooperative transport;
that transport concern is outside this minimal reproduction.

## Environment

- Ruby: tested with Ruby 4.0.5; Ruby 3.x is also relevant to the issue
- sentry-ruby: 6.7.0
- eventmachine: 1.2.7
- em-synchrony: 1.0.6
- concurrent-ruby: resolved by sentry-ruby (1.3.x)
- OS: Linux
