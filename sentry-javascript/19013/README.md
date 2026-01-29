# Reproduction for sentry-javascript#19013

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19013

## Description

When using `@sentry/bun` with Express, incoming HTTP requests don't get properly scoped isolation. Two distinct requests end up sharing the same trace ID instead of each having their own unique trace ID.

## Prerequisites

- [Bun](https://bun.sh/) installed (tested with v1.3.4)

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bun install
   ```

2. (Optional) Set your Sentry DSN:
   ```bash
   export SENTRY_DSN="your-dsn-here"
   ```

3. Start the server:
   ```bash
   bun run start
   ```

4. In another terminal, run the test script:
   ```bash
   bun run test
   ```

   Or manually make requests:
   ```bash
   curl http://localhost:3000/endpoint1
   curl http://localhost:3000/endpoint2
   curl http://localhost:3000/endpoint1
   ```

## Expected Behavior

Each incoming HTTP request should have its own unique trace ID. The automatic instrumentation should capture inbound requests and create new root spans for each request.

## Actual Behavior

Multiple distinct web requests are bundled under the same trace ID. The scope isolation is not working correctly, causing requests to share the same trace context.

Example output showing the bug (server logs):
```
--- Request: GET /endpoint1 ---
Trace ID: NO TRACE ID
Span ID: NO SPAN ID

--- Request: GET /endpoint2 ---
Trace ID: NO TRACE ID
Span ID: NO SPAN ID
```

Test script output:
```
=== Results ===

Request 1: endpoint1 -> Trace ID: NO TRACE ID
Request 2: endpoint2 -> Trace ID: NO TRACE ID
Request 3: endpoint1 -> Trace ID: NO TRACE ID
...

=== Summary ===

Total requests: 6
Unique trace IDs: 0

❌ BUG: No trace IDs were generated at all
```

## Environment

- Bun: 1.3.4
- @sentry/bun: 10.37.0
- express: ^4.21.0
- OS: Any (tested on macOS)

## Notes

The issue report mentions that the only workaround is to manually start a new span for each incoming request, but this should be handled automatically by the SDK's instrumentation.
