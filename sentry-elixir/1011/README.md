# Reproduction for sentry-elixir#1011

**Issue:** https://github.com/getsentry/sentry-elixir/issues/1011

## Description

Sentry's `SpanProcessor` drops child spans that start (or end) after the root/parent span finishes. This commonly happens with async work patterns in Elixir such as `Task.async`, Broadway consumers, Oban workers, and Ecto queries triggered asynchronously from a web request.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   mix deps.get
   ```

2. Set your Sentry DSN:
   ```bash
   export SENTRY_DSN="https://examplePublicKey@o0.ingest.sentry.io/0"
   ```

3. Run the reproduction:
   ```bash
   mix run -e "Repro.run()"
   ```

## Expected Behavior

Two transactions should be reported with the same `trace_id`, appearing in Sentry as one trace with 3 spans:
- `sync_root`
  - `async_parent`
    - `async_child`

## Actual Behavior

Only `sync_root` is reported. The `async_parent` and `async_child` spans are silently dropped because their parent span is no longer in `SpanStorage` when they are processed.

```
=== Reproduction: Async spans dropped by SpanProcessor ===

[1] Creating root span 'sync_root'...
    Root span started and finishing immediately.
[2] Root span 'sync_root' has ended.
[3] Starting async Task that will create child spans...

    [async] 'async_parent' span started
    [async] 'async_child' span started
    [async] 'async_child' span ending
    [async] 'async_parent' span ending

=== EXPECTED BEHAVIOR ===
  Two transactions reported with the same trace_id.
  The trace in Sentry should show 3 spans:
    - sync_root
      - async_parent
        - async_child

=== ACTUAL BEHAVIOR ===
  Only 'sync_root' is reported.
  'async_parent' and 'async_child' are silently dropped because
  their parent span is no longer in SpanStorage when they finish.
```

## Root Cause

In `Sentry.OpenTelemetry.SpanProcessor.process_span/1`, the processor looks up the parent span in `SpanStorage`. When the root span finishes first and gets cleaned up from storage, the async child spans can't find their parent and are dropped.

The issue reporter suggests the fix may be to treat all spans whose parent doesn't exist in `SpanStorage` as a transaction root, so they are still reported.

## Notes

This reproduction was not verified locally (Elixir was not available on the authoring machine). Please confirm the behavior after running the steps above.

## Environment

- Elixir: >= 1.15
- sentry: ~> 12.0
- opentelemetry: ~> 1.5
