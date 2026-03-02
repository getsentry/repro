# Reproduction for sentry-javascript#19580

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19580

## Description

`reactRouterTracingIntegration` produces `[object Object]` as transaction name when navigating using a `<Link>` (or `navigate()`) with an object `to` prop, e.g.:

```tsx
<Link to={{ pathname: "/items/2", search: "redirectTo=%2F" }}>
```

The root cause is in the patched `navigate` function which uses `String(args[0])` to derive the transaction name. When called with an object, `String({...})` produces `"[object Object]"`.

## Steps to Reproduce

1. Set your Sentry DSN:
   ```bash
   export VITE_SENTRY_DSN=<your-dsn>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open the app in your browser (http://localhost:5173)

5. Click **"Link with object to={{ pathname: "/items/2", search: "..." }}"** — this navigates using an object `to` prop

6. Check Sentry: the transaction name for this navigation will be `[object Object]`

7. For comparison, click **"Link with string to="/items/1?redirectTo=%2F""** — this navigates using a string `to` prop and the transaction name is correct

## Expected Behavior

Transaction name should be the resolved pathname (e.g., `/items/2`), not `[object Object]`.

## Actual Behavior

Transaction name is `[object Object]` when navigating with an object `to` prop.

## Environment

- `@sentry/react-router`: ^9.38.0
- React Router: v7 (framework mode)
- React: 19
