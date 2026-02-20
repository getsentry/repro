# Reproduction for sentry-javascript#17742

**Issue:** https://github.com/getsentry/sentry-javascript/issues/17742

## Description

Breadcrumbs from background jobs (cron tasks, graphile-worker, BullMQ, etc.) leak into HTTP request error events in NestJS. Background jobs run outside the HTTP request context, so they add breadcrumbs to the default isolation scope. When a new HTTP request arrives, `httpServerIntegration` clones the default scope — inheriting all those stale breadcrumbs.

## Steps to Reproduce

1. Add a `.env` file with your Sentry DSN:
   ```bash
   echo "SENTRY_DSN=<your-dsn>" > .env
   ```

2. Install dependencies and run the reproduction:
   ```bash
   npm install
   npm run test:repro
   ```

   This builds the app, starts it, waits for background jobs to pollute the default scope, then triggers an error via HTTP.

3. Check the output — the `beforeSend` hook logs all breadcrumbs on the error event.

## Expected Behavior

The error event from `GET /trigger-error` should only contain its own breadcrumb:
```
=== Sentry Event Breadcrumbs (1 total) ===
  [0] category=http-request, message=About to trigger an error in HTTP handler
```

## Actual Behavior

The error event contains breadcrumbs from background jobs that ran before the request:
```
=== Sentry Event Breadcrumbs (21 total) ===
  ...
  [9]  category=background-job, message=Background job #1 started
  [10] category=background-job, message=Background job #1 completed
  ...
  [20] category=http-request, message=About to trigger an error in HTTP handler

*** BUG CONFIRMED: 6 breadcrumbs leaked from background jobs! ***
```

## Root Cause

In `packages/node-core/src/integrations/http/httpServerIntegration.ts:185`:
```ts
const isolationScope = getIsolationScope().clone();
```

This clones the **default** isolation scope, which has been polluted by background job breadcrumbs. The cloned scope inherits all those breadcrumbs, causing them to appear on HTTP request error events.

## Environment

- Node.js: v18+
- @sentry/nestjs: ^10.2.0
- @nestjs/core: ^10.0.0
- @nestjs/schedule: ^6.1.1
