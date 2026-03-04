# Reproduction for sentry-javascript#18962

**Issue:** https://github.com/getsentry/sentry-javascript/issues/18962

## Description

Sentry's tracing instrumentation (`tracesSampleRate: 1.0`) reportedly breaks OpenAI streaming when using LangChain/LangGraph's `agent.stream()` with `streamMode: ["messages"]`. Instead of receiving incremental chunks, the entire response arrives in one or very few chunks.

## Test Results

**On latest versions (`@sentry/nestjs@10.42.0`, `langchain@1.2.29`), the bug does not reproduce.**

Both endpoints stream correctly with Sentry tracing enabled:

| Endpoint | Sentry | Content Chunks | First Byte | Total |
|---|---|---|---|---|
| `/stream-agent` | OFF | ~40 | ~0.7s | ~1.2s |
| `/stream-agent` | ON | ~46 | ~0.5s | ~1.0s |
| `/stream-model` | ON | ~41 | ~0.7s | ~1.1s |

The fix was likely included in one of the recent `@sentry/nestjs` releases (possibly PR #19122, released in 10.39.0). The issue was reported on 10.41.0 by @rad20c — pinning to that version may reproduce it.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. Add your OpenAI API key to `.env`:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```

3. Run **without** Sentry (baseline):
   ```bash
   npm run start:without-sentry
   ```
   Then in another terminal:
   ```bash
   curl http://localhost:3000/stream-agent
   ```

4. Stop the server, then run **with** Sentry:
   ```bash
   npm run start:with-sentry
   ```
   Then:
   ```bash
   curl http://localhost:3000/stream-agent
   ```

5. Compare chunk counts and timing between the two modes. The `/stream-model` endpoint is available for comparison with direct `ChatOpenAI` streaming.

## Environment

- `@sentry/nestjs`: 10.42.0
- `langchain`: 1.2.29
- `@langchain/openai`: 1.2.12
- Node.js: 18+
