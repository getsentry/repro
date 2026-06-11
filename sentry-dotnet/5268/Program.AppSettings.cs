// Alternative reproduction using appsettings.json instead of inline DSN.
// To use this variant, rename this file to Program.cs and the original to something else.
//
// This demonstrates the same bug via appsettings.json configuration:
// When Sentry.Dsn is set in appsettings.json AND .WriteTo.Sentry() is used,
// builder.Build() throws.

using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog with the Sentry sink
builder.Host.UseSerilog((_, c) =>
    c.Enrich.FromLogContext()
        .MinimumLevel.Debug()
        .WriteTo.Console()
        .WriteTo.Sentry(s =>
        {
            s.MinimumBreadcrumbLevel = LogEventLevel.Debug;
            s.MinimumEventLevel = LogEventLevel.Error;
        }));

// UseSentry() without a DSN parameter - it reads from appsettings.json instead
// The DSN in appsettings.json triggers the same double-initialization bug
builder.WebHost.UseSentry();

// This throws the same exception
var app = builder.Build();

app.MapGet("/", () => "Hello World");

Console.WriteLine("If you see this, the bug did NOT reproduce - builder.Build() succeeded.");
app.Run();
