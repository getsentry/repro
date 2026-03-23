# Reproduction for sentry-javascript#19902

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19902

## Description

`@sentry/sveltekit@10.45.0` causes Vercel build failure when loading `vite.config.ts`.
The import chain `@sentry/sveltekit` → `@sentry/node` → `@prisma/instrumentation` → `@opentelemetry/instrumentation`
fails on Vercel with Node 24.x because of an incorrect ESM resolution path in `@prisma/instrumentation`.

## Steps to Reproduce

1. Set your Sentry DSN:
   ```bash
   cp .env.example .env
   # edit .env with your DSN
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Deploy to Vercel (set Node.js version to 24.x in Vercel project settings).

4. The build should fail with:
   ```
   Error: Cannot find package '.../node_modules/@prisma/instrumentation/node_modules/@opentelemetry/instrumentation/index.js'
   ```

## Expected Behavior

Importing `@sentry/sveltekit` in `vite.config.ts` should not cause a build failure on Vercel.

## Actual Behavior

Vercel build fails during `vite.config.ts` load with `ERR_MODULE_NOT_FOUND` for `@opentelemetry/instrumentation`.

## Environment

- Node.js: 24.x (Vercel)
- `@sentry/sveltekit`: 10.45.0
- `@sveltejs/kit`: ^2.55.0
- `@sveltejs/adapter-vercel`: ^6.3.3
- Vite: ^6.0.0
