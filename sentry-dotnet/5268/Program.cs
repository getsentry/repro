using Serilog;
using Serilog.Events;

// Reproduction for https://github.com/getsentry/sentry-dotnet/issues/5268
//
// BUG: Using both UseSentry(dsn) AND .WriteTo.Sentry() causes an exception
// at builder.Build() when a real DSN is provided.
//
// The Serilog Sentry sink tries to initialize the SDK separately,
// conflicting with the ASP.NET Core integration's initialization.
//
// Variant 1 (default): DSN provided inline via UseSentry(dsn)
// Variant 2: Set USE_APPSETTINGS=1 to read DSN from appsettings.json instead

var dsn = Environment.GetEnvironmentVariable("SENTRY_DSN")
    ?? "https://examplePublicKey@o0.ingest.sentry.io/0";

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((_, c) =>
    c.Enrich.FromLogContext()
        .MinimumLevel.Debug()
        .WriteTo.Console()
        .WriteTo.Sentry(s =>
        {
            s.MinimumBreadcrumbLevel = LogEventLevel.Debug;
            s.MinimumEventLevel = LogEventLevel.Error;
        }));

if (Environment.GetEnvironmentVariable("USE_APPSETTINGS") == "1")
{
    // Variant 2: reads DSN from appsettings.json "Sentry:Dsn"
    builder.WebHost.UseSentry();
}
else
{
    // Variant 1: DSN provided directly
    builder.WebHost.UseSentry(dsn);
}

// EXPECTED: Build succeeds without errors
// ACTUAL: Exception is thrown due to double SDK initialization
try
{
    var app = builder.Build();
    app.MapGet("/", () => "Hello World");
    Console.WriteLine("Bug NOT reproduced - builder.Build() succeeded.");
    app.Run();
}
catch (Exception ex)
{
    Console.WriteLine("BUG CONFIRMED: builder.Build() threw an exception");
    Console.WriteLine($"Exception type: {ex.GetType().FullName}");
    Console.WriteLine($"Message: {ex.Message}");
    if (ex.InnerException != null)
    {
        Console.WriteLine($"Inner exception: {ex.InnerException.GetType().FullName}");
        Console.WriteLine($"Inner message: {ex.InnerException.Message}");
    }
    Console.WriteLine();
    Console.WriteLine($"Full stack trace:\n{ex}");
    Environment.Exit(1);
}
