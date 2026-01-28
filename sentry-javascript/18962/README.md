# Reproduction for sentry-javascript#18962

**Issue:** https://github.com/getsentry/sentry-javascript/issues/18962

## Description

This reproduction attempts to demonstrate the reported issue where OpenAI streaming breaks when Sentry is initialized in a NestJS application with `@sentry/nestjs`.

**Note:** In our testing, streaming works correctly both with and without Sentry enabled. We need more details from the issue reporter to reproduce the exact issue.

## Setup

This is a NestJS application that uses:
- `@sentry/nestjs` v10.x (with OpenAI and LangChain integrations)
- `@langchain/openai` for LangChain integration

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your configuration:
   ```bash
   OPENAI_API_KEY=sk-your-key-here
   SENTRY_DSN=https://your-dsn@sentry.io/project
   ENABLE_SENTRY=true
   ```

   Set `ENABLE_SENTRY=true` to enable Sentry, or omit/set to any other value to disable.

3. Build the TypeScript:
   ```bash
   npm run build
   ```

4. Run the server:
   ```bash
   npm run start
   ```

5. Test streaming:
   ```bash
   curl http://localhost:3000/stream-langchain
   curl http://localhost:3000/stream-openai
   ```

## Available Endpoints

- `GET /` - Status and available endpoints
- `GET /stream-openai` - Test OpenAI streaming via LangChain's ChatOpenAI
- `GET /stream-langchain` - Test OpenAI streaming via LangChain

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
