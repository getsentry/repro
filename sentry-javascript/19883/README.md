# Reproduction for sentry-javascript#19883

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19883

## Description

`instrumentWorkflowWithSentry` from `@sentry/cloudflare` swallows the
`WorkflowStepContext` (`ctx`) parameter in `step.do` callbacks. This means
`ctx.attempt` (and any future properties on the context) is `undefined` when
Sentry instrumentation is active.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the worker:
   ```bash
   npm run dev
   ```

3. Trigger the workflow:
   ```bash
   curl http://localhost:8787/run
   ```

4. Observe the wrangler console output.

## Expected Behavior

```
ctx: {"attempt":1}
ctx?.attempt: 1
OK: ctx.attempt = 1
```

## Actual Behavior

```
ctx: undefined
ctx?.attempt: undefined
BUG: ctx is undefined — Sentry wrapper swallowed it!
```

The JSON response also shows no `attempt` field:
```json
{"id":"...","details":{"status":"complete","output":{"message":"hello from repro"}}}
```

## Environment

- `@sentry/cloudflare`: 10.45.0
- wrangler: 4.75.0
- `compatibility_date`: 2025-12-18
