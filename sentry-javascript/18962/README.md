# Reproduction for sentry-javascript#18962

**Issue:** https://github.com/getsentry/sentry-javascript/issues/18962

## Description

This reproduction attempts to demonstrate the reported issue where OpenAI streaming breaks when Sentry is initialized in a NestJS application with `@sentry/nestjs`.

**Note:** In our testing, streaming works correctly both with and without Sentry enabled. We need more details from the issue reporter to reproduce the exact issue.

## Setup

This is a NestJS application that uses:
- `@sentry/nestjs` v10.x (with OpenAI integration)
- `openai` SDK for direct API calls
- `@langchain/openai` for LangChain integration

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript:
   ```bash
   npm run build
   ```

3. Set your OpenAI API key:
   ```bash
   export OPENAI_API_KEY=sk-your-key-here
   ```

4. Optionally set Sentry DSN:
   ```bash
   export SENTRY_DSN=https://your-dsn@sentry.io/project
   ```

5. Test WITHOUT Sentry:
   ```bash
   npm run start:without-sentry
   # In another terminal:
   curl http://localhost:3000/stream
   ```

6. Test WITH Sentry:
   ```bash
   npm run start:with-sentry
   # In another terminal:
   curl http://localhost:3000/stream
   ```

## Available Endpoints

- `GET /` - Status and available endpoints
- `GET /stream` - Test OpenAI streaming with `for await`
- `GET /stream-langchain` - Test OpenAI streaming via LangChain
- `GET /stream-web` - Test OpenAI streaming with `toReadableStream()`
- `GET /stream-sse` - Test OpenAI streaming with Server-Sent Events

## Expected Behavior (per issue)

According to the issue, with Sentry enabled:
- Streaming should break
- Only the final complete response should come through (1-2 chunks)
- Real-time streaming behavior should not work

## Actual Behavior (our testing)

In our testing with `@sentry/nestjs@10.36.0`:
- Streaming works correctly with Sentry enabled
- 40+ chunks received for all streaming methods
- No difference between Sentry enabled/disabled

## Environment

- Node.js: 22.x
- @sentry/nestjs: 10.36.0
- @nestjs/core: 10.x
- openai: 4.x
- @langchain/openai: 1.x

## Questions for Issue Reporter

To help reproduce the issue, please provide:

1. **Exact SDK version**: What specific version of `@sentry/nestjs` are you using?
2. **Node.js version**: What Node.js version?
3. **Sentry.init config**: Full Sentry initialization config
4. **NestJS setup**: Any interceptors, middleware, or guards that might affect responses?
5. **OpenAI usage**: Exact code showing how you're using OpenAI/LangChain
6. **Network config**: Any proxies or custom HTTP agents?

## Workaround (from issue)

The issue reporter found that `defaultIntegrations: false` helps, suggesting one of the default integrations causes the problem. Try narrowing down which integration:

```typescript
Sentry.init({
  dsn: '...',
  // Try disabling specific integrations to find the culprit
  integrations: (integrations) => {
    return integrations.filter((integration) => {
      // Try filtering different integrations
      return integration.name !== 'OpenAI';
    });
  },
});
```
