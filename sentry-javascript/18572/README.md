# Reproduction for sentry-javascript#18572

**Issue:** https://github.com/getsentry/sentry-javascript/issues/18572

## Current Verdict

This setup matches the reporter's architecture and is useful for investigating the issue, but it is **not currently a confirmed local reproduction**.

On this branch, local testing with the included load client produced:
- normal `EXPECTED_ROOT` entries for top-level request spans
- correctly parented `CHILD` spans for gRPC and internal work
- no `UNEXPECTED_ROOT` spans during the observed runs

Treat this directory as an investigation harness for `sentry-javascript#18572`, not proof that the bug reproduces locally.

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
- A `ContextDebugSpanProcessor` that separates `EXPECTED_ROOT`, `CHILD`, and `UNEXPECTED_ROOT` spans so normal request roots are not mistaken for broken propagation

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
   - `UNEXPECTED_ROOT` on spans that should have a parent (for example `grpc.*`, `db-lookup`, `validation`, controller spans)
   - `EXPECTED_ROOT` on incoming request spans such as `GET /test-grpc` - these are normal
   - `CHILD` spans sharing the same `traceId` as their surrounding request - this indicates healthy propagation

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

## Reported Actual Behavior

Under load (especially with gRPC), context is randomly lost, causing spans to appear as independent root spans with different trace IDs:

```
HTTP GET /test-grpc (root, traceId=aaa)
[CONTEXT-DEBUG] UNEXPECTED_ROOT "grpc.hero.HeroService/FindOne" traceId=bbb  <-- should be child of above
[CONTEXT-DEBUG] UNEXPECTED_ROOT "db-lookup" traceId=ccc                       <-- should be child of above
```

`EXPECTED_ROOT` entries for top-level spans like `GET /test-grpc` are normal and are not evidence of the bug by themselves.

## Local Result So Far

Using the setup in this directory and the included load client, the issue has not been observed locally so far. In the observed runs:
- request root spans were logged as `EXPECTED_ROOT`
- gRPC spans and internal spans remained children of the request trace
- no suspicious `UNEXPECTED_ROOT` spans were emitted

**Note:** The reporter was unable to reproduce this locally and only sees it in production. The reproduction provides the minimal setup to investigate the issue, but it may require higher concurrency or a production-like environment to manifest.

## Environment

- Node.js: 22.x
- `@sentry/nestjs`: 10.31.0
- `@sentry/opentelemetry`: 10.31.0
- `@nestjs/core`: 11.x
- `@opentelemetry/sdk-node`: 0.208.0
