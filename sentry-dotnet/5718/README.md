# Reproduction for sentry-dotnet#5718

**Issue:** https://github.com/getsentry/sentry-dotnet/issues/5718

## Description

When `SentryAspNetCoreOptions.TransactionNameProvider` throws, the Sentry tracing middleware
never finishes the transaction, so it is dropped. The exception also escapes the middleware
and fails the request.

The repro runs an ASP.NET Core app on `TestServer` with no routing (so the SDK falls back to the
`TransactionNameProvider`), a provider that throws, and a dummy DSN. `BeforeSendTransaction`
records transactions and drops them, so nothing is sent.

## Steps to Reproduce

Requires the .NET 8 SDK.

```bash
dotnet run
```

Exits 1 and prints `BUG REPRODUCED` when the transaction is dropped (or named after the raw URL path).

To run against a local `sentry-dotnet` checkout instead of the NuGet package:

```bash
dotnet run -p:SentryAspNetCoreProject=/path/to/sentry-dotnet/src/Sentry.AspNetCore/Sentry.AspNetCore.csproj
```

## Expected Behavior

The transaction is still captured, named `<unlabeled transaction>` rather than the request URL
(which may contain PII).

## Actual Behavior

```
GET /users/jane.doe@example.com threw: HttpRequestException: Error while copying content to a stream.
Captured transactions: 0
BUG REPRODUCED: the transaction was dropped because TransactionNameProvider threw.
```

## Environment

- .NET: 8.0
- Sentry.AspNetCore: 7.0.0
- OS: Linux
