# Reproduction for sentry-javascript#19367

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19367

## Description

Next.js 16 Turbopack bundles `@opentelemetry/api` into **separate chunks** for the
instrumentation hook (Sentry SDK init) and each route handler. This creates multiple
module instances that share the global context manager via `Symbol.for("opentelemetry.js.api.1")`,
but have separate `ContextAPI` singletons and module closures.

In `@sentry/nextjs` 10.38.0, `_startSpan()` nests 3 `context.with()` calls:
```
context.with(suppressedCtx)           <- copy A's ContextAPI
  -> tracer.startActiveSpan()
    -> api.context.with(ctxWithSpan)   <- copy B's ContextAPI
      -> context.with(activeCtx)       <- copy A's ContextAPI
        -> callback
```

With duplicated module instances, the `SentryContextManager`'s scope cloning and
re-entry through the async context strategy can spiral into infinite recursion,
causing `RangeError: Maximum call stack size exceeded`.

This did not happen with `@sentry/nextjs` 10.8.0 because `startSpan()` only had
**1** `context.with()` call (inside `tracer.startActiveSpan()`), keeping the
re-entry depth bounded.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build with Turbopack (the default for Next.js 16):
   ```bash
   npm run build
   ```

3. **Verify the duplication in build output:**
   ```bash
   npm run check-otel-dedup
   ```
   This analyzes which chunks each route and the instrumentation hook load,
   confirming they get **different** copies of `@opentelemetry/api`.

4. Start the production server:
   ```bash
   npm start
   ```

5. Test the diagnostic endpoint:
   ```bash
   curl http://localhost:3000/api/otel-check | python3 -m json.tool
   ```

6. Test the realistic route with nested Sentry spans:
   ```bash
   curl http://localhost:3000/api/test | python3 -m json.tool
   ```

7. Load test to attempt triggering the crash (intermittent):
   ```bash
   for i in $(seq 1 500); do curl -s http://localhost:3000/api/test > /dev/null & done; wait
   ```

## What the check script shows

`npm run check-otel-dedup` maps the exact chunk loading for each entry point:

```
=== @opentelemetry/api duplication analysis ===

Instrumentation OTel chunks:
  [root-of-the-server]__963c8309._.js (8KB) -- Symbol.for: true, ContextAPI: false
  _0066dbbb._.js (4684KB) -- Symbol.for: false, ContextAPI: true

/api/test OTel chunks:
  [root-of-the-server]__3f199e61._.js (9KB) -- Symbol.for: true, ContextAPI: false
  [root-of-the-server]__8f25289d._.js (161KB) -- Symbol.for: false, ContextAPI: true

  *** DUPLICATION DETECTED for /api/test ***
  Instrumentation-only OTel chunks: __963c8309, _0066dbbb
  Route-only OTel chunks: __3f199e61, __8f25289d
  -> Different module instances with separate ContextAPI singletons
```

## Routes

| Route | Purpose |
|---|---|
| `/api/otel-check` | Diagnostic: tests `context.with()` (single + 3-deep nested), reports global OTel registry state |
| `/api/test` | Realistic: nested `Sentry.startSpan()` calls simulating DB queries + external API calls |

## Investigation Findings

### Structural Evidence (Confirmed)

After `npm run build`, the `check-otel-dedup` script confirms that the instrumentation
hook and each route handler load **different chunks** containing `@opentelemetry/api`.
Every route gets its own copy. The instrumentation hook and route handlers never share
OTel chunks.

**Two ContextAPI class definitions in the same chunk:** The route handler chunk contains
two separate `ContextAPI` class definitions -- one Turbopack ESM-style (used by route
handler code) and one CJS-style (bundled from `@prisma/instrumentation`'s nested
`@opentelemetry/instrumentation` dependency). Both call `_getContextManager()` which
reads from `globalThis[Symbol.for("opentelemetry.js.api.1")]`, so they share the same
context manager but are separate JavaScript objects with separate closures, singletons,
and prototype chains.

**Version-independent:** The duplication occurs identically with both `@sentry/nextjs`
10.8.0 and 10.38.0 (8 chunks with OTel `Symbol.for`, 2 with `ContextAPI` in both).

**`prismaIntegration()` makes no difference:** Removing `Sentry.prismaIntegration()`
produces identical chunk structure. The `@prisma/instrumentation` package is bundled
because it is a direct dependency of `@sentry/node`, not because of the integration call.

### Runtime Behavior (Crash Not Reproduced)

| Test | Result |
|---|---|
| Single `context.with()` call | Passes |
| 3-deep nested `context.with()` (mimicking `_startSpan`) | Passes |
| Alternating Copy A / Copy B `context.with()` | Passes |
| 1000 concurrent mixed A/B `context.with()` calls | Passes |
| `Sentry.startSpan()` with nested spans + Copy B `context.with()` | Passes |
| 500 concurrent HTTP requests to `/api/test` | Server survives |
| `--stack-size=128` with concurrent load | Server survives |
| Monkey-patching instrumentation's `ContextAPI.with()` | Never triggered by routes (confirming separate singletons) |

**Why the crash doesn't reproduce locally:** The `SentryContextManager.with()` calls
`super.with()` which ends at `asyncLocalStorage.run(ctx, fn)` -- it does **not** call
back to any `ContextAPI.with()`. So there is no direct recursive loop between the two
ContextAPI singletons.

**Remaining hypotheses for the crash:**
- Node.js v24 runtime differences (different ALS behavior or stack limits)
- Actual Prisma DB queries creating deeper instrumentation chains
- pnpm workspace resolution causing different module nesting
- `next-intl` middleware adding wrapping to the Next.js config
- Sustained production traffic ("minutes to hours" under load)
- Duplicate copies of `require-in-the-middle`/`import-in-the-middle` both patching
  the same modules, creating re-entrant wrapping chains

### Turbopack's Behavior Is By Design

Per-route self-contained bundles are intentional. A Turbopack contributor (lukesandberg)
confirmed on [vercel/next.js#89192](https://github.com/vercel/next.js/issues/89192):

> "Bundling the module into multiple different output chunks is expected. The different
> routes may end up in different lambdas in production and so need to be self-contained."

However, the runtime deduplication layer that is supposed to compensate is not working
correctly for `@opentelemetry/api`. The Turbopack runtime uses a shared `moduleCache`
but the build output shows separate module definitions with different module IDs across
chunks.

**Known gaps:**
- [vercel/next.js#89192](https://github.com/vercel/next.js/issues/89192) -- Duplicate
  class definitions across route chunks, breaking `instanceof` (same root cause)
- [vercel/next.js#89252](https://github.com/vercel/next.js/issues/89252) -- Related
  chunking issue where unused CSS is included across routes
- Turbopack status page lists "Production Optimized JS Chunking" as still in progress
- Webpack does not have this problem (SplitChunksPlugin deduplicates shared deps)

### The `serverExternalPackages` Workaround

Adding `@opentelemetry/api` to `serverExternalPackages` in `next.config.js` forces
Node.js native `require()` resolution at runtime, bypassing Turbopack's bundling:

```js
const nextConfig = {
  serverExternalPackages: ["@opentelemetry/api"],
};
```

This guarantees a single module instance because Node.js `require()` caches modules.
`@opentelemetry/api` is **not** on Next.js's built-in auto-externalized packages list,
though `@sentry/profiling-node` and `import-in-the-middle` are. Adding it upstream
would be a reasonable fix.

### OTel's Singleton Design vs Bundler Reality

`@opentelemetry/api` uses `Symbol.for("opentelemetry.js.api.1")` to store a global
registry on `globalThis`. This design was intended for the npm/yarn flat `node_modules`
world where multiple _versions_ might coexist. It was not designed for bundler-created
duplicate instances of the _same version_ in the same process.

**What the `Symbol.for` pattern protects:** global context manager registration,
global tracer provider registration, version compatibility checks.

**What it does NOT protect:** class identity (`instanceof` fails across copies),
module closures (each copy has its own), singleton instances (`ContextAPI.getInstance()`
returns a different object per copy), instrumentation registration (two copies may
both try to hook into the same Node.js modules).

## Conclusions

**Confirmed:**
1. Turbopack creates separate `@opentelemetry/api` module instances -- reproducible and deterministic
2. This is a known Turbopack limitation -- runtime deduplication does not work correctly here
3. Webpack does not have this problem
4. The duplication is SDK-version-independent (10.8.0 and 10.38.0 identical)
5. `prismaIntegration()` is irrelevant -- duplication comes from `@sentry/node`'s bundled `@prisma/instrumentation`

**Not confirmed:**
1. The actual infinite recursion mechanism -- could not trigger `RangeError` in any test
2. Why 10.38.0 crashes but 10.8.0 doesn't -- structural duplication is identical
3. The exact conditions -- likely requires Node.js v24, real Prisma queries, pnpm, or sustained production traffic

**Recommended actions:**

| Action | Owner | Priority |
|---|---|---|
| Add `@opentelemetry/api` to `serverExternalPackages` | Users (workaround) | Immediate |
| Add `@opentelemetry/api` to Next.js built-in externals list | Next.js team | Short-term |
| Fix Turbopack runtime module deduplication | Turbopack team | Medium-term |
| Track [vercel/next.js#89192](https://github.com/vercel/next.js/issues/89192) | All | Ongoing |

## Environment

- `@sentry/nextjs`: 10.38.0
- `next`: 16.1.6 (Turbopack)
- `@prisma/instrumentation`: ^7.4.0
- Node.js: v20+ (reporter uses v24)
