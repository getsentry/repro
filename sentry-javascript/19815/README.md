# Reproduction for sentry-javascript#19815

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19815

## Description

When tracing is disabled (no `tracesSampleRate` set), all errors from different
requests are assigned the **same** `traceId`. Without an active span per request,
the SDK never creates a fresh propagation context for each incoming request, so
every event ends up on the same static trace.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Set your Sentry DSN to also see events in Sentry UI:
   ```bash
   export SENTRY_DSN=https://<key>@sentry.io/<project>
   ```

3. Run the automated test (starts the server, fires 5 requests, then exits):
   ```bash
   bash test.sh
   ```

   Or run the server manually and send requests yourself:
   ```bash
   npm start
   # in another terminal:
   curl http://localhost:3000
   curl http://localhost:3000
   curl http://localhost:3000
   ```

## Expected Behavior

Each request produces a **unique** `traceId`, so unrelated errors are not
grouped into the same trace.

## Actual Behavior

All requests share the same `traceId`. Example output:

```
[request #1] propagation traceId: e551c9b4398346c88486608a44c0a2a2
[request #2] propagation traceId: e551c9b4398346c88486608a44c0a2a2
[request #3] propagation traceId: e551c9b4398346c88486608a44c0a2a2
[request #4] propagation traceId: e551c9b4398346c88486608a44c0a2a2
[request #5] propagation traceId: e551c9b4398346c88486608a44c0a2a2
```

This creates a false impression in Sentry that unrelated errors from different
requests belong to the same execution flow.

## Environment

- Node.js: v22.15.0
- @sentry/node: 10.43.0
- express: ^5.2.1
