# Reproduction for sentry-dotnet#5265

**Issue:** https://github.com/getsentry/sentry-dotnet/issues/5265

## Description

The issue reports that `ISentryEventProcessor` implementations registered via DI
(`builder.Services.AddTransient<ISentryEventProcessor, ExampleEventProcessor>()`) are **not** called
when logging through `Microsoft.Extensions.Logging.ILogger` (e.g., `log.LogError(...)`), but **are**
called when logging through the static Serilog logger (`Log.Logger.Error(...)`).

## Steps to Reproduce

1. Build and run with Docker:
   ```bash
   docker build -t sentry-repro-5265 .
   docker run --rm -p 8085:8080 sentry-repro-5265
   ```

   Optionally set a real Sentry DSN:
   ```bash
   export SENTRY_DSN=https://your-dsn@sentry.io/0
   docker run --rm -p 8085:8080 -e SENTRY_DSN sentry-repro-5265
   ```

2. Trigger the test:
   ```bash
   curl http://localhost:8085/test
   ```

3. Check the server console output for `ExampleEventProcessor.Process CALLED!` messages.

## Expected Behavior

`ExampleEventProcessor.Process` should be called for **both**:
- Test 1: `Log.Logger.Error(...)` (static Serilog logger)
- Test 2: `log.LogError(...)` (ILogger from Microsoft.Extensions.Logging)

## Actual Behavior

According to the issue, `ExampleEventProcessor.Process` is only called for Test 1 (static Serilog),
**not** for Test 2 (ILogger).

**Note:** In this reproduction (Sentry 6.5.0, .NET 10), the event processor IS called for both paths.
The issue author reports the bug when running from Visual Studio with a debugger attached. The bug may
be related to how the debugger interacts with the event processing pipeline, or to a specific
environment configuration.

## Environment

- .NET: 10.0
- Sentry.AspNetCore: 6.5.0
- Sentry.Serilog: 6.5.0
- Serilog: 4.3.1
- Serilog.AspNetCore: 10.0.0
