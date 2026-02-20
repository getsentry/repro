# Reproduction for sentry-javascript#17742

**Issue:** https://github.com/getsentry/sentry-javascript/issues/17742

## Description

Breadcrumbs from background jobs leak into HTTP request error events in NestJS. Background jobs run outside the HTTP request context, so they add breadcrumbs to the default isolation scope. When a new HTTP request arrives, `httpServerIntegration` clones the default scope — inheriting all those stale breadcrumbs.

This reproduction covers **all four** common NestJS background job patterns:

| Framework | Decorator | External Dep | Env Var |
|-----------|-----------|-------------|---------|
| `@nestjs/schedule` | `@Interval` / `@Cron` | None | Always active |
| `@nestjs/event-emitter` | `@OnEvent` | None | Always active |
| `@nestjs/bullmq` | `@Processor` | Redis | `REDIS_URL` |
| `nestjs-graphile-worker` | `@Task` | PostgreSQL | `DATABASE_URL` |

## Steps to Reproduce

1. Add a `.env` file with your Sentry DSN (and optionally Redis/PostgreSQL):
   ```bash
   SENTRY_DSN=<your-dsn>
   # Optional:
   # REDIS_URL=redis://localhost:6379
   # DATABASE_URL=postgres://user:pass@localhost:5432/dbname
   ```

2. Install dependencies and run:
   ```bash
   npm install
   npm run test:repro
   ```

3. Check the output for leaked breadcrumbs.

## Expected Behavior

The error event from `GET /trigger-error` should only contain its own breadcrumb:
```
=== Sentry Event Breadcrumbs (1 total) ===
  [0] category=http-request, message=About to trigger an error in HTTP handler
```

## Actual Behavior

```
*** BUG CONFIRMED: Breadcrumbs leaked from background jobs! ***
  Leaked: schedule-job: 3, event-job: 2
```

## Root Cause

In `packages/node-core/src/integrations/http/httpServerIntegration.ts:185`:
```ts
const isolationScope = getIsolationScope().clone();
```

Background jobs execute on the default isolation scope (no HTTP request forked a new one). Their breadcrumbs accumulate on the default scope. When `httpServerIntegration` handles a new request, it clones the default scope — including all stale breadcrumbs from background jobs.

## Environment

- Node.js: v18+
- @sentry/nestjs: ^10.2.0
- @nestjs/core: ^10.0.0
- @nestjs/schedule: ^6.1.1
- @nestjs/event-emitter: latest
- @nestjs/bullmq: latest (optional)
- nestjs-graphile-worker: latest (optional)
