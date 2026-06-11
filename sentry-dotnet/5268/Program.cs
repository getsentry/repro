using Serilog;
using Serilog.Events;

// Reproduction for https://github.com/getsentry/sentry-dotnet/issues/5268
//
// BUG: Using both UseSentry(dsn) AND .WriteTo.Sentry() causes an exception
// at builder.Build() when a real DSN is provided.
//
// The Serilog Sentry sink tries to initialize the SDK separately,
// conflicting with the ASP.NET Core integration's initialization.

var dsn = Environment.GetEnvironmentVariable("SENTRY_DSN")
    ?? "https://examplePublicKey@o0.ingest.sentry.io/0";

var builder = WebApplication.CreateBuilder(args);

// Step 1: Configure Serilog with the Sentry sink
builder.Host.UseSerilog((_, c) =>
    c.Enrich.FromLogContext()
        .MinimumLevel.Debug()
        .WriteTo.Console()
        // This configures the Serilog Sentry sink
        .WriteTo.Sentry(s =>
        {
            s.MinimumBreadcrumbLevel = LogEventLevel.Debug;
            s.MinimumEventLevel = LogEventLevel.Error;
        }));

// Step 2: Also configure Sentry via ASP.NET Core integration with a DSN
// When a DSN is provided here, both integrations try to initialize the SDK
builder.WebHost.UseSentry(dsn);

// Step 3: This call throws an exception due to the double initialization
// EXPECTED: Build succeeds without errors
// ACTUAL: Exception is thrown
var app = builder.Build();

app.MapGet("/", () => "Hello World");

Console.WriteLine("If you see this, the bug did NOT reproduce - builder.Build() succeeded.");
app.Run();
