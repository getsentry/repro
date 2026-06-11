# Reproduction for sentry-dotnet#5268

**Issue:** https://github.com/getsentry/sentry-dotnet/issues/5268

## Description

When using both `builder.WebHost.UseSentry(dsn)` and `.WriteTo.Sentry()` (Serilog sink) together with a real DSN, `builder.Build()` throws an exception. The Serilog Sentry sink attempts to initialize the SDK separately, conflicting with the ASP.NET Core integration's initialization.

This reproduces the bug reported in the `Sentry.Samples.AspNetCore.Serilog` sample when a real DSN is provided.

## Prerequisites

- .NET 8.0 SDK (or later)

## Steps to Reproduce

### Variant 1: DSN via code

1. Install dependencies:
   ```bash
   dotnet restore
   ```

2. Run the reproduction:
   ```bash
   dotnet run
   ```

   The DSN is hardcoded as a placeholder. You can also set a real one:
   ```bash
   export SENTRY_DSN="https://your-key@o0.ingest.sentry.io/0"
   dotnet run
   ```

### Variant 2: DSN via appsettings.json

1. Replace `Program.cs` with the appsettings variant:
   ```bash
   mv Program.cs Program.Inline.cs
   mv Program.AppSettings.cs Program.cs
   ```

2. The DSN is already set in `appsettings.json`. Run:
   ```bash
   dotnet restore
   dotnet run
   ```

## Expected Behavior

The application starts successfully and serves requests on `http://localhost:5000`.

## Actual Behavior

An exception is thrown at `builder.Build()` due to the Sentry SDK being initialized twice — once by the ASP.NET Core integration (`UseSentry(dsn)`) and again by the Serilog sink (`.WriteTo.Sentry()`).

## Workaround

Remove the DSN parameter from `UseSentry()` and avoid setting `Sentry.Dsn` in appsettings, or use the simpler Serilog overload that doesn't trigger SDK initialization:

```csharp
.WriteTo.Sentry(minimumBreadcrumbLevel: LogEventLevel.Debug, minimumEventLevel: LogEventLevel.Error)
```

## Note

This reproduction was not tested locally (no .NET SDK available on the build machine). The code follows the exact pattern described in the issue and the upstream sample code. Please verify by running `dotnet run` with a .NET 8+ SDK.

## Environment

- .NET: 8.0+
- Sentry.AspNetCore: 6.6.0
- Sentry.Serilog: 6.6.0
- Serilog: 2.12.0
