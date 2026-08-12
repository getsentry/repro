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

The reproduction uses a controlled subclass of Sentry's real `HTTPTransport`.
It requires `SENTRY_DSN`, sends the captured envelope to that DSN, and pauses
the worker's request long enough to force the relevant thread/fiber
interleaving. Use a test project/DSN because this sends a real event.

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

The script prints the endpoint, sends one real envelope, and reports whether
the HTTP request completed. The reproduction deterministically holds the
worker task open, then makes an EventMachine fiber acquire the executor's lock.
On the tested runtime, the default-worker run logs the reported `FiberError`
from the worker while it tries to return to the executor. The controlled HTTP
transport sends the request to the supplied DSN after releasing the test gate;
with different transport timing, the issue can prevent an event from being
sent.

## Expected Behavior

`Sentry.capture_exception` should dispatch the event through the background
worker and the HTTP transport should send exactly one event without a
`FiberError`.

## Actual Behavior

In affected applications/runtimes, the background worker's executor uses the
fiber-aware mutex from an incompatible thread/fiber context. In this script,
`SENTRY_DSN` is required and the event is sent through the real HTTP transport.
The worker can fail while updating executor state after the request gate is
released. em-synchrony's `Mutex#unlock` schedules a fiber resume with
`EM.next_tick`, producing the reported `FiberError: attempt to resume a
transferring fiber`; depending on where the failure occurs in a real
application, the event may be lost.

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
