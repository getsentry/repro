# Reproduction for sentry-javascript#19912

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19912

## Description

Sentry's Anthropic instrumentation breaks the `.withResponse()` method on the promise returned by `client.messages.create()`. The Anthropic SDK returns an `APIPromise` with a `.withResponse()` method for accessing raw response data (headers, status, etc.), but Sentry's instrumentation wraps it in a regular Promise, losing that method.

## Steps to Reproduce

1. Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Run the reproduction:
   ```bash
   yarn start
   ```

## Expected Behavior

`.withResponse()` should work and return the raw response alongside the parsed data.

## Actual Behavior

`result.withResponse is not a function`

## Environment

- Node.js: 22
- @sentry/node: 10.45.0
- @anthropic-ai/sdk: 0.52.0
