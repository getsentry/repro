# Reproduction for sentry-javascript#18572

**Issue:** https://github.com/getsentry/sentry-javascript/issues/18572

## Description

OpenTelemetry context is not propagated correctly when using `@sentry/nestjs` with a custom OpenTelemetry setup (`skipOpenTelemetrySetup: true`) and `SentryContextManager`. Traces randomly break into multiple partial traces, with internal spans appearing as root spans instead of being children of the correct parent.

Key observations from the reporter:
- Worked fine up to Sentry SDK v10.25.0, broke after v10.27.0
- Suspected related to [#18178](https://github.com/getsentry/sentry-javascript/issues/18178) / [PR #18239](https://github.com/getsentry/sentry-javascript/pull/18239)
- Only manifests in production under load, particularly with gRPC endpoints
- HTTP-only services work fine
- Disabling Sentry entirely (`enabled: false`) resolves the issue
- Removing `tracesSampleRate` and `SentrySpanProcessor` does **not** fix it

## Setup

This reproduction creates a NestJS hybrid app with both HTTP and gRPC endpoints, matching the reporter's setup:
- Sentry initialized with `skipOpenTelemetrySetup: true`
- Custom OTel SDK with `SentryContextManager`, `SentryPropagator`, and `SentrySpanProcessor`
- Custom sampler using `wrapSamplingDecision` (matches reporter's health-check filter)
- gRPC microservice with `@opentelemetry/instrumentation-grpc`
- A `ContextDebugSpanProcessor` that logs root vs child spans to help identify broken context propagation

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npx nest build
   ```

3. Start the server (optionally set SENTRY_DSN):
   ```bash
   export SENTRY_DSN=  # leave empty or set a real DSN
   node dist/instrument.js
   ```

4. In another terminal, run the test client:
   ```bash
   node dist/test-client.js
   ```

5. Check the server logs for `[CONTEXT-DEBUG]` entries. Look for:
   - `ORPHAN span ended (no parent)` - indicates broken context propagation
   - `ROOT span started` on spans that should be children (e.g., `db-lookup`, `validation`)

## Testing with different Sentry versions

To compare behavior between working (v10.25.0) and broken (v10.27.0+) versions:

```bash
# Test with broken version (current)
npm install @sentry/nestjs@10.31.0 @sentry/opentelemetry@10.31.0
npx nest build && node dist/instrument.js

# Test with last known working version
npm install @sentry/nestjs@10.25.0 @sentry/opentelemetry@10.25.0
npx nest build && node dist/instrument.js
```

## Expected Behavior

All spans within a single HTTP request should share the same `traceId` and be correctly parented. For example, a `GET /test-grpc` request should produce a trace like:

```
HTTP GET /test-grpc (root)
  └── gRPC /hero.HeroService/FindOne (child)
       └── db-lookup (child)
```

## Actual Behavior

Under load (especially with gRPC), context is randomly lost, causing spans to appear as independent root spans with different trace IDs:

```
HTTP GET /test-grpc (root, traceId=aaa)
gRPC /hero.HeroService/FindOne (root, traceId=bbb)  <-- should be child of above
db-lookup (root, traceId=ccc)                         <-- should be child of above
```

**Note:** The reporter was unable to reproduce this locally and only sees it in production. The reproduction provides the minimal setup that triggers the issue. It may require higher concurrency or a production-like environment to manifest.

## Environment

- Node.js: 22.x
- `@sentry/nestjs`: 10.31.0
- `@sentry/opentelemetry`: 10.31.0
- `@nestjs/core`: 11.x
- `@opentelemetry/sdk-node`: 0.208.0
