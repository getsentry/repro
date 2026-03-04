# Reproduction for sentry-javascript#18962

**Issue:** https://github.com/getsentry/sentry-javascript/issues/18962

## Description

Sentry's tracing instrumentation (`tracesSampleRate: 1.0`) breaks OpenAI streaming when using LangGraph's `agent.stream()` with `streamMode: ["messages"]`. Instead of receiving incremental chunks, the entire response arrives in one or very few chunks.

The bug is specific to **agent-level streaming** (LangGraph `createReactAgent` + `agent.stream()`). Direct `model.stream()` calls appear to work correctly.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. Export your OpenAI API key:
   ```bash
   export OPENAI_API_KEY=sk-your-key-here
   ```

3. Optionally set a Sentry DSN (not required to see the streaming behavior):
   ```bash
   export SENTRY_DSN=
   ```

4. Run **without** Sentry (baseline - streaming works):
   ```bash
   npm run start:without-sentry
   ```
   Then in another terminal:
   ```bash
   curl http://localhost:3000/stream-agent
   ```
   You should see chunks arriving incrementally.

5. Stop the server, then run **with** Sentry (streaming breaks):
   ```bash
   npm run start:with-sentry
   ```
   Then:
   ```bash
   curl http://localhost:3000/stream-agent
   ```
   The response arrives all at once instead of streaming.

6. For comparison, the direct model streaming endpoint works in both modes:
   ```bash
   curl http://localhost:3000/stream-model
   ```

## Expected Behavior

`agent.stream()` should deliver chunks incrementally regardless of whether Sentry tracing is enabled.

## Actual Behavior

With `tracesSampleRate: 1.0`, the agent stream delivers the full response in one chunk (or very few chunks) instead of streaming incrementally. Removing `tracesSampleRate` or setting it to `0` restores correct streaming behavior.

## Workarounds

- Remove `tracesSampleRate` from Sentry config
- Set `defaultIntegrations: false` (requires manually adding needed integrations)

## Environment

- `@sentry/nestjs`: ^10.41.0
- `@langchain/openai`: ^0.5.0
- `@langchain/langgraph`: ^0.2.0
- Node.js: 18+
