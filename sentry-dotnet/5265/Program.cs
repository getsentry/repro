using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Sentry;
using Sentry.AspNetCore;
using Sentry.Extensibility;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((_, c) =>
    c.Enrich.FromLogContext()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .WriteTo.Sentry());

builder.Services.AddTransient<ISentryEventProcessor, ExampleEventProcessor>();

((IWebHostBuilder)builder.WebHost).UseSentry(o =>
{
    o.Dsn = Environment.GetEnvironmentVariable("SENTRY_DSN")
        ?? "https://examplePublicKey@o0.ingest.sentry.io/0";
    o.Debug = true;
});

var app = builder.Build();

app.Use(async (context, next) =>
{
    var log = context.RequestServices.GetRequiredService<ILoggerFactory>()
        .CreateLogger("ReproTest");

    if (context.Request.Path == "/test")
    {
        ExampleEventProcessor.CallCount = 0;

        Console.WriteLine();
        Console.WriteLine("========================================");
        Console.WriteLine("=== Test 1: Static Serilog Logger ===");
        Console.WriteLine("========================================");
        // Goes through: Serilog -> WriteTo.Sentry() -> SentrySink -> SentrySdk.CaptureEvent
        Log.Logger.Error("Error via static Serilog logger");

        await Task.Delay(500);
        var countAfterTest1 = ExampleEventProcessor.CallCount;

        Console.WriteLine();
        Console.WriteLine("========================================");
        Console.WriteLine("=== Test 2: ILogger (log.LogError) ===");
        Console.WriteLine("========================================");
        // Goes through: ILogger -> Serilog (via UseSerilog) -> WriteTo.Sentry() -> SentrySink
        // BUG: ISentryEventProcessor should be called but reportedly is not
        log.LogError(new InvalidOperationException("test exception"), "Error via ILogger");

        await Task.Delay(500);
        var countAfterTest2 = ExampleEventProcessor.CallCount;

        Console.WriteLine();
        Console.WriteLine("========================================");
        Console.WriteLine("=== Summary ===");
        Console.WriteLine("========================================");
        Console.WriteLine($"ExampleEventProcessor called after Test 1: {countAfterTest1} time(s)");
        Console.WriteLine($"ExampleEventProcessor called after Test 2: {countAfterTest2 - countAfterTest1} time(s)");

        if (countAfterTest2 - countAfterTest1 == 0)
        {
            Console.WriteLine("BUG CONFIRMED: ISentryEventProcessor was NOT called for ILogger path!");
        }
        else
        {
            Console.WriteLine("Bug NOT reproduced: ISentryEventProcessor was called for both paths.");
        }

        context.Response.ContentType = "text/plain";
        await context.Response.WriteAsync(
            $"Test 1 (static Serilog): ExampleEventProcessor called {countAfterTest1} time(s)\n" +
            $"Test 2 (ILogger):        ExampleEventProcessor called {countAfterTest2 - countAfterTest1} time(s)\n" +
            "Check the server console for full details.\n");
    }
    else
    {
        await next();
    }
});

app.MapGet("/", () => "Navigate to /test to trigger the reproduction");

app.Run();

sealed class ExampleEventProcessor : ISentryEventProcessor
{
    public static int CallCount;

    public SentryEvent Process(SentryEvent @event)
    {
        Interlocked.Increment(ref CallCount);
        Console.WriteLine($">>> ExampleEventProcessor.Process CALLED! (call #{CallCount})");
        Console.WriteLine($"    Message: {@event.Message?.Formatted ?? "(no message)"}");
        Console.WriteLine($"    Exception: {@event.Exception?.Message ?? "(no exception)"}");
        return @event;
    }
}
