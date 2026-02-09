# Reproduction for sentry-dotnet#4902

**Issue:** https://github.com/getsentry/sentry-dotnet/issues/4902

## Description

When upgrading from Sentry.AspNetCore SDK v5.16.2 to v6.0.0, a `TypeLoadException` occurs during application startup:

```
System.TypeLoadException: Could not load type 'BindableSentryExperimentalOptions' from assembly 'Sentry, Version=6.0.0.0'
```

This error happens when the SDK tries to bind configuration from `appsettings.json` using source-generated configuration binding.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   dotnet restore
   ```

2. Run the application:
   ```bash
   dotnet run
   ```

## Expected Behavior

The ASP.NET Core application should start successfully with Sentry SDK v6.0.0 configured, just as it did with v5.16.2.

## Actual Behavior

The application crashes during startup with:

```
Unhandled exception. System.TypeLoadException: Could not load type 'BindableSentryExperimentalOptions' from assembly 'Sentry, Version=6.0.0.0, Culture=neutral, PublicKeyToken=[REDACTED]'.
   at Microsoft.Extensions.Configuration.Binder.SourceGeneration.<BindingExtensions_g>F69BD955067CC1B62D0915FD5271F3D3428E092A00BA3FDBE06C4BF5D97765D7A__BindingExtensions.BindCore(IConfiguration configuration, BindableSentryAspNetCoreOptions& instance, Boolean defaultValueIfNotFound, BinderOptions binderOptions)
   at Microsoft.Extensions.Configuration.Binder.SourceGeneration.<BindingExtensions_g>F69BD955067CC1B62D0915FD5271F3D3428E092A00BA3FDBE06C4BF5D97765D7A__BindingExtensions.Bind_BindableSentryAspNetCoreOptions(IConfiguration configuration, Object instance)
   at Sentry.AspNetCore.SentryAspNetCoreOptionsSetup.Configure(SentryAspNetCoreOptions options)
```

## Workaround

Reverting to v5.16.2 resolves the issue:
```bash
dotnet add package Sentry.AspNetCore -v 5.16.2
```

## Environment

- .NET SDK: 9.0.101
- Sentry.AspNetCore: 6.0.0
- OS: macOS

## Notes

This reproduction attempts to recreate the conditions described in the issue. The error may be environment-specific or related to build cache/AOT compilation settings. If the error doesn't reproduce immediately, try:

1. Clean and rebuild:
   ```bash
   dotnet clean
   rm -rf bin/ obj/
   dotnet build
   ```

2. Check if you have any global.json or Directory.Build.props files that might affect the build

3. The issue mentions MAUI workloads were installed - try with/without MAUI workloads installed

The issue reporter confirmed that downgrading to v5.16.2 fixes the problem, suggesting this is a regression in v6.0.0 related to the source-generated configuration binding for `BindableSentryExperimentalOptions`.
