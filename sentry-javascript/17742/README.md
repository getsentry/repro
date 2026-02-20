# Reproduction for sentry-javascript#17742

**Issue:** https://github.com/getsentry/sentry-javascript/issues/17742

## Description

Breadcrumbs from earlier, unrelated requests leak into later Sentry error events in NestJS. This indicates that request isolation isn't working as expected — breadcrumbs are being stored on the default (global) isolation scope instead of per-request scopes.

## Steps to Reproduce

1. Export your Sentry DSN (or run without one to see local debug output):
   ```bash
   export SENTRY_DSN=<your-dsn>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build and start the server:
   ```bash
   npm run build && npm start
   ```

4. In another terminal, hit the routes in sequence:
   ```bash
   curl http://localhost:3000/route-a
   sleep 1
   curl http://localhost:3000/route-b
   sleep 1
   curl http://localhost:3000/trigger-error
   ```

5. Check the server output — the `beforeSend` hook logs all breadcrumbs attached to the error event.

## Expected Behavior

The error event from `/trigger-error` should only contain its own breadcrumb:
```
=== Sentry Event Breadcrumbs (1 total) ===
  [0] category=trigger-error, message=About to trigger an error
```

## Actual Behavior

The error event contains breadcrumbs from all previous requests:
```
=== Sentry Event Breadcrumbs (6 total) ===
  [0] category=route-a, message=Processing route A - step 1
  [1] category=route-a, message=Processing route A - step 2
  [2] category=route-a, message=Route A completed successfully
  [3] category=route-b, message=Processing route B - step 1
  [4] category=route-b, message=Route B completed successfully
  [5] category=trigger-error, message=About to trigger an error

*** BUG CONFIRMED: Breadcrumbs leaked from other requests! ***
```

The Sentry debug logs also show: `"Isolation scope is still the default isolation scope, skipping setting transactionName."` — confirming that requests are not getting their own isolation scopes.

## Environment

- Node.js: v18+
- @sentry/nestjs: ^10.2.0
- @nestjs/core: ^10.0.0
