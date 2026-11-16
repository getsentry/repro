// Reproduction for getsentry/sentry-dotnet#5718
//
// If SentryAspNetCoreOptions.TransactionNameProvider throws, the transaction is dropped
// (never finished/captured) and the exception escapes the Sentry tracing middleware.
//
// Expected: the transaction is still captured, named "<unlabeled transaction>"
//           (and not the raw URL path, which may contain PII).
// Actual:   no transaction is captured.

using System.Collections.Concurrent;
using Microsoft.AspNetCore.TestHost;
using Sentry;

var captured = new ConcurrentBag<SentryTransaction>();

var host = new WebHostBuilder()
    .UseSentry(o =>
    {
        // Dummy DSN: the SDK is enabled, but the hooks below drop everything, so nothing is sent.
        o.Dsn = "https://public@example.com/1";
        o.TracesSampleRate = 1.0;
        o.TransactionNameProvider = _ => throw new InvalidOperationException("TransactionNameProvider failed");
        o.SetBeforeSendTransaction(t =>
        {
            captured.Add(t);
            return null;
        });
        o.SetBeforeSend(_ => null);
    })
    .Configure(app =>
    {
        app.UseSentryTracing();
        // No routing: the SDK falls back to the TransactionNameProvider for the transaction name.
        app.Run(ctx => ctx.Response.WriteAsync("ok"));
    });

using var server = new TestServer(host);
var client = server.CreateClient();

var sentryAssembly = typeof(SentrySdk).Assembly;
Console.WriteLine($"Sentry loaded from: {sentryAssembly.Location}");
Console.WriteLine($"Sentry.AspNetCore loaded from: {typeof(Sentry.AspNetCore.SentryAspNetCoreOptions).Assembly.Location}");

const string path = "/users/jane.doe@example.com";
try
{
    var response = await client.GetAsync(path);
    Console.WriteLine($"GET {path} -> {(int)response.StatusCode}");
}
catch (Exception e)
{
    Console.WriteLine($"GET {path} threw: {e.GetType().Name}: {e.Message}");
}

await SentrySdk.FlushAsync(TimeSpan.FromSeconds(2));

Console.WriteLine($"Captured transactions: {captured.Count}");
foreach (var t in captured)
{
    Console.WriteLine($"  name='{t.Name}' source={t.NameSource}");
}

var transaction = captured.SingleOrDefault();
if (transaction is null)
{
    Console.WriteLine("BUG REPRODUCED: the transaction was dropped because TransactionNameProvider threw.");
    return 1;
}

if (transaction.Name.Contains(path))
{
    Console.WriteLine("BUG REPRODUCED: the transaction name contains the raw request path (possible PII).");
    return 1;
}

if (transaction.Name != "<unlabeled transaction>")
{
    Console.WriteLine($"UNEXPECTED: expected '<unlabeled transaction>', got '{transaction.Name}'.");
    return 1;
}

Console.WriteLine("OK: the transaction was kept and named '<unlabeled transaction>'.");
return 0;
