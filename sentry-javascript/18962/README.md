# Reproduction for sentry-javascript#18962

**Issue:** [Sentry breaking OpenAI STREAMING](https://github.com/getsentry/sentry-javascript/issues/18962)

## Description

This reproduction demonstrates that Sentry's instrumentation breaks OpenAI streaming capabilities. When Sentry is initialized (via `--import ./instrument.mjs`), OpenAI streaming returns only the last full response instead of incremental chunks, breaking the real-time streaming behavior.

The issue occurs even when:
- The OpenAI integration is explicitly filtered out
- `process.env.OTEL_NODE_DISABLED_INSTRUMENTATIONS = 'openai'` is set
- Various other workarounds are attempted

The only reliable workaround is setting `defaultIntegrations: false`, but this requires manually re-enabling all needed integrations.

## Prerequisites

You need an OpenAI API key to run this reproduction:

```bash
export OPENAI_API_KEY=sk-your-key-here
```

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. First, test **WITHOUT** Sentry (baseline - this should work correctly):
   ```bash
   npm run start:without-sentry
   ```

   **Expected behavior:** You should see incremental streaming with multiple chunks being received in real-time as the model generates the response.

3. Now test **WITH** Sentry enabled:
   ```bash
   npm run start:with-sentry
   ```

## Expected Behavior

OpenAI streaming should work the same way with or without Sentry:
- Multiple chunks should be received incrementally
- Content should stream in real-time as it's generated
- The chunk count should be relatively high (10+ chunks for a typical response)

## Actual Behavior (Bug)

When Sentry is enabled via `--import ./instrument.mjs`:
- Streaming appears broken
- Only 1-2 chunks are received (typically just the final complete response)
- No real-time incremental updates
- The response arrives all at once instead of streaming

## Environment

- Node.js: v20+ (ESM modules)
- @sentry/node: ^8.0.0
- openai: ^4.77.0

## Notes

- The reproduction uses a simplified Node.js setup instead of full NestJS to isolate the issue
- The core problem is the same: Sentry's auto-instrumentation interferes with stream handling
- Even filtering out the OpenAI integration doesn't resolve the issue
- This suggests the problem may be in Sentry's underlying HTTP/fetch instrumentation affecting stream processing

## Known Workaround

Setting `defaultIntegrations: false` in Sentry initialization prevents the issue, but requires manually enabling all needed integrations:

```javascript
Sentry.init({
  dsn: '...',
  defaultIntegrations: false,
  integrations: [
    // Manually add only the integrations you need
  ],
});
```
