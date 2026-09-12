# Reproduction for sentry-dotnet#4819

**Issue:** https://github.com/getsentry/sentry-dotnet/issues/4819

## Description

This reproduction demonstrates a bug where Sentry removes structured logging properties from scopes when the same parameter name is used in both `BeginScope()` and in a log message parameter.

When using `ILogger.BeginScope()` to define structured data properties (e.g., `Queue.HandlerName`) and then logging a message with the same parameter name, Sentry incorrectly removes the property from the scope data. This breaks the ability to filter and search logs by these structured data properties.

## The Bug

**What should happen:**
- Scope property `Queue.HandlerName` should remain in `property.Queue.HandlerName`
- Log message parameter `{Queue.HandlerName}` should appear in `message.parameters.Queue.HandlerName`
- Both values should be preserved

**What actually happens:**
- When a log message uses the same parameter name as a scope property, Sentry removes the property from the scope data entirely
- Only the message parameter is preserved
- This breaks searching/filtering by structured data properties

## Steps to Reproduce

### 1. Set up Sentry DSN (optional)

If you want to see the logs in Sentry:
```bash
export SENTRY_DSN="your-dsn-here"
```

If you leave it empty, the logs will still be visible in the console output showing the bug behavior.

### 2. Build and run the application

```bash
cd SentryLoggingRepro
dotnet build
dotnet run
```

The application will start on http://localhost:5000 (or check the console output for the actual port).

### 3. Trigger the reproduction

Open your browser or use curl to hit the test endpoints:

```bash
# Basic test (matches the original issue)
curl http://localhost:5000/test

# Detailed test with multiple scenarios
curl http://localhost:5000/test-detailed
```

### 4. Observe the bug

Check the console output or your Sentry dashboard. You'll see that:

- **Log 1** (before scope): `property.Queue.HandlerName` is NOT present (expected, no scope yet)
- **Log 2** (inside scope with same param name): `property.Queue.HandlerName` is MISSING (BUG! Should be "JobProcessorFromScope")
- **Log 3** (inside scope without param): `property.Queue.HandlerName` is present with "JobProcessorFromScope" (correct)

The bug is in Log 2 - when you log with a parameter that has the same name as a scope property, Sentry removes the scope property entirely.

## Expected Behavior

All logs within the scope should have `property.Queue.HandlerName` set to `"JobProcessorFromScope"`, regardless of whether the log message also uses `{Queue.HandlerName}` as a parameter.

The scope properties should be used for filtering and searching, while message parameters are for the rendered message template.

## Actual Behavior

Sentry's deduplication logic incorrectly removes scope properties when a log message parameter has the same name. This breaks the structured logging workflow where:
1. You set up a scope with contextual properties (e.g., handler name, request ID)
2. You log messages that may reference those same properties

## Environment

- **.NET SDK:** 10.0.102
- **Sentry.AspNetCore:** 6.0.0
- **Sentry.Serilog:** 6.0.0
- **Serilog.AspNetCore:** 10.0.0
- **OS:** macOS (should reproduce on any OS)

## Impact

This bug prevents using structured logging properties from scopes for filtering/searching in Sentry when the log message parameters happen to use the same names. This is a common pattern where:
- Scopes define contextual data for a block of code (e.g., `Queue.HandlerName`)
- Individual log messages reference that context in their message templates

Users expect scope properties to always be available for filtering, regardless of message parameters.

## Related Issue Comments

The reproduction steps are based on this comment: https://github.com/getsentry/sentry-dotnet/issues/4819#issuecomment-3834832076
