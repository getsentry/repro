# Reproduction for sentry-dotnet#5268

**Issue:** https://github.com/getsentry/sentry-dotnet/issues/5268

## Description

When using both `builder.WebHost.UseSentry(dsn)` and `.WriteTo.Sentry(options => {...})` (Serilog sink with `Action<SentrySerilogOptions>` overload), `builder.Build()` throws an `ArgumentNullException`. The Serilog sink calls `SentrySdk.Init()` with options that have no DSN set — the DSN configured via `UseSentry(dsn)` is not available to the sink at that point.

## Steps to Reproduce

### With Docker

```bash
docker build -t sentry-repro-5268 .
docker run --rm sentry-repro-5268
```

### Without Docker

Requires .NET 8.0+ SDK.

**Variant 1** — DSN via code (default):
```bash
dotnet restore
dotnet run
```

**Variant 2** — DSN via appsettings.json:
```bash
dotnet restore
USE_APPSETTINGS=1 dotnet run
```

## Expected Behavior

The application starts successfully.

## Actual Behavior

`builder.Build()` throws:

```
System.ArgumentNullException: Value cannot be null.
(Parameter 'You must supply a DSN to use Sentry. To disable Sentry, pass an empty string: "".
See https://docs.sentry.io/platforms/dotnet/configuration/options/#dsn')
   at Sentry.Internal.SettingLocator.GetDsn()
   at Sentry.SentrySdk.InitHub(SentryOptions options)
   at Sentry.SentrySdk.Init(SentryOptions options)
   at Serilog.SentrySinkExtensions.Sentry(...)
```

The Serilog sink's `.WriteTo.Sentry(Action<SentrySerilogOptions>)` overload calls `SentrySdk.Init()` internally, but the DSN is null because it was configured separately via `UseSentry(dsn)`.

## Workaround

Use the simpler Serilog overload that doesn't trigger SDK initialization:

```csharp
.WriteTo.Sentry(minimumBreadcrumbLevel: LogEventLevel.Debug, minimumEventLevel: LogEventLevel.Error)
```

## Environment

- .NET: 8.0+
- Sentry.AspNetCore: 6.6.0
- Sentry.Serilog: 6.6.0
- Serilog: 2.12.0
