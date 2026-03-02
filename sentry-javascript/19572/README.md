# Reproduction for sentry-javascript#19572

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19572

## Description

`localVariablesIntegration` does not capture nested object contents in AWS Lambda. Local variables that are objects appear as empty `{}` in Sentry, even though the same object attached via `Sentry.setExtra()` is fully preserved. Increasing `normalizeDepth` does not help.

## Steps to Reproduce

1. Export your Sentry DSN (or use the dummy one for local testing):
   ```bash
   export SENTRY_DSN=<your-dsn>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the reproduction:
   ```bash
   npm start
   ```

## Expected Behavior

The `payload` local variable should appear with its full nested structure in the Local Variables section, similar to how it appears when attached via `Sentry.setExtra()`.

## Actual Behavior

The `payload` local variable is captured as just `{}` (empty object) with no nested properties, while the exact same object attached via `Sentry.setExtra()` shows the complete structure:

```
--- Local variables captured for processRequest ---
{
  "simpleString": "hello world",       // ✅ primitive string captured
  "simpleNumber": 42,                   // ✅ primitive number captured
  "flatObject": { "key": "value", "count": 10 },  // ✅ flat object captured
  "payload": {}                         // ❌ nested object is empty!
}

--- Same object attached via Sentry.setExtra() ---
{
  "user": { "id": 123, "profile": { "name": "Test User", ... } },
  "items": [{ "id": 1, "nested": { "deep": { "value": "should be visible" } } }]
}
```

Primitives and flat objects are captured correctly. Only deeply nested objects lose their contents.

## Environment

- @sentry/aws-serverless: 10.36.0
- Node.js: v22+
