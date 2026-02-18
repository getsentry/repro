# Reproduction for sentry-javascript#19367

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19367

## Description

Next.js 16 with Turbopack (the default bundler) splits `@opentelemetry/api` across
multiple server-side chunks instead of deduplicating it into a single module instance.
When two chunks each contain their own copy of the OTel `ContextAPI`, the `.with()`
method of each copy delegates to the _other_ copy's `.with()`, creating infinite mutual
recursion that fatally crashes the Node.js process with:

```
RangeError: Maximum call stack size exceeded
```

This reproduces with `@sentry/nextjs` 10.38.0 + Next.js 16.1.6 Turbopack and does **not**
reproduce on `@sentry/nextjs` 10.8.0.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Export your Sentry DSN – the app works without one, but events won't be sent:
   ```bash
   export SENTRY_DSN=https://your-key@oXXXXXX.ingest.sentry.io/XXXXXX
   ```

3. Build with Turbopack (the default for Next.js 16):
   ```bash
   npm run build
   ```

4. **Detect the duplicate OTel chunks immediately after the build:**
   ```bash
   npm run check-otel-dedup
   ```
   Expected output shows `@opentelemetry/api` duplicated across 7 server-side chunks.

5. Start the production server:
   ```bash
   npm start
   ```

6. Send requests to trigger OTel context propagation:
   ```bash
   # Single request
   curl http://localhost:3000/api/test

   # Load test – the crash is intermittent; sustained traffic triggers it
   for i in $(seq 1 500); do curl -s http://localhost:3000/api/test > /dev/null; done
   ```

The server may crash with `RangeError: Maximum call stack size exceeded` during or after
the load test. The crash is non-deterministic – it can happen within minutes or after
several hours of traffic (matching the original report).

## Expected Behavior

`@opentelemetry/api` is loaded as a single module instance. The `.with()` context method
works without recursion and the server remains stable.

## Actual Behavior

`npm run check-otel-dedup` reports:

```
✗ BUG DETECTED: @opentelemetry/api module definition found in 7 chunks:
    - [root-of-the-server]__14b38a08._.js
    - [root-of-the-server]__1a01c8dc._.js
    - [root-of-the-server]__6126aa9f._.js
    - [root-of-the-server]__ab5f2c12._.js
    - [root-of-the-server]__da904e4a._.js
    - [root-of-the-server]__f934a92d._.js
    - node_modules_@opentelemetry_a01cbabd._.js
```

Under sustained traffic the server crashes:

```
RangeError: Maximum call stack size exceeded
    at ContextAPI.with (.next/server/chunks/[root-of-the-server]__14b38a08._.js:...)
    at ContextAPI.with (.next/server/chunks/node_modules_@opentelemetry_a01cbabd._.js:...)
    at ContextAPI.with (.next/server/chunks/[root-of-the-server]__14b38a08._.js:...)
    ...
```

## Environment

- Node.js: v24.12.0 (also reproduces on v22)
- `@sentry/nextjs`: 10.38.0
- `next`: 16.1.6 (Turbopack)
- `@prisma/instrumentation`: ^7.4.0
- OS: Linux (Debian 12) / macOS (development)
