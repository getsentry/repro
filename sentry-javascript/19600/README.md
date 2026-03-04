# Reproduction for sentry-javascript#19600

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19600

## Description

When using `@sentry/nextjs` with Turbopack and `@clerk/nextjs`, Clerk's middleware detection fails on `/.well-known` requests when a catch-all route (`app/[...rest]/page.tsx`) exists. This causes `auth()` errors when Chrome DevTools is opened (which triggers `/.well-known` requests).

The issue does **not** occur when building with Webpack (`npm run build:webpack`).

## Prerequisites

You need Clerk API keys. Create a free account at https://clerk.com and get your keys from the dashboard.

## Steps to Reproduce

1. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your Clerk keys:
   # NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   # CLERK_SECRET_KEY=sk_test_...
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build with Turbopack (default):
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Open http://localhost:3000/ in Chrome

6. Open Chrome DevTools (View -> Developer -> Developer Tools)

## Expected Behavior

Opening DevTools should not affect app rendering or auth/middleware state. No errors.

## Actual Behavior

A series of errors appear:

```
⨯ Error: Clerk: auth() was called but Clerk can't detect usage of clerkMiddleware().
Please ensure the following:
- Your Middleware exists at ./middleware.(ts|js) or proxy.(ts|js)
- clerkMiddleware() is used in your Next.js Middleware.
- Your Middleware matcher is configured to match this route or page.
...
```

## Workaround

Building with Webpack instead of Turbopack does not exhibit this issue:

```bash
npm run build:webpack
npm start
```

## Key Files

- `proxy.ts` - Clerk middleware (using `proxy.ts` instead of `middleware.ts`)
- `app/[...rest]/page.tsx` - Catch-all route (required to trigger the bug)
- `next.config.ts` - Sentry + Next.js config with `withSentryConfig`

## Environment

- Next.js: 16.1.6
- @sentry/nextjs: ^10.41.0
- @clerk/nextjs: ^6.39.0
