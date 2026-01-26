# Reproduction for sentry-rust#946

**Issue:** https://github.com/getsentry/sentry-rust/issues/946

## Description

When the same tracing span is entered by multiple threads simultaneously, esoteric behavior occurs. The hub switch guard from one thread gets dropped by another thread, causing spans to not be properly entered/exited and child spans to potentially appear in the wrong hierarchy.

## Steps to Reproduce

1. Set your Sentry DSN:
   ```bash
   export SENTRY_DSN="your-dsn-here"
   ```

2. Run the reproduction:
   ```bash
   cargo run
   ```

3. Check your Sentry dashboard to see the trace.

## Expected Behavior

The span hierarchy should be:
```
foo (transaction)
├── bar
└── baz
```

Both `bar` and `baz` should appear as children of `foo`, with no conflicts between threads.

## Actual Behavior

Due to the bug:
- Entering the span on thread 2 causes the hub switch guard of thread 1 to be dropped in thread 2
- Thread 2 does not actually enter the hub
- When exiting the span in thread 1, it doesn't actually exit the hub (because hub_switch_guard was set to None by thread 2)
- Child spans may appear incorrectly nested (e.g., `baz` appearing inside `bar` instead of as siblings)

## Environment

- sentry: 0.46.0
- sentry-tracing: 0.46.0
- tracing: 0.1
