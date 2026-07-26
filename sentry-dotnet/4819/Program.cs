using Sentry;
using Sentry.Serilog;
using Serilog;
using Serilog.Events;

// Configure Serilog with Sentry sink
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .WriteTo.Sentry(o =>
    {
        o.Dsn = Environment.GetEnvironmentVariable("SENTRY_DSN");
        o.Debug = true;
        o.MinimumBreadcrumbLevel = LogEventLevel.Debug;
        o.MinimumEventLevel = LogEventLevel.Information;
    })
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog for ASP.NET Core
builder.Host.UseSerilog();

// Configure Sentry for ASP.NET Core
builder.WebHost.UseSentry(options =>
{
    options.Dsn = Environment.GetEnvironmentVariable("SENTRY_DSN");
    options.Debug = true;
    options.TracesSampleRate = 1.0d;
    options.Environment = "development";

    // Enable logs
    options.EnableLogs = true;

    // Add a no-op SetBeforeSendLog callback for debugging
    options.SetBeforeSendLog((log) =>
    {
        // Breakpoint here to inspect the log before it's sent to Sentry
        return log;
    });
});

var app = builder.Build();

// Add test endpoint that demonstrates the bug
app.MapGet("/test", (ILogger<Program> logger) =>
{
    var queueHandlerForScope = "JobProcessorFromScope";
    var queueHandlerForLogs = "JobProcessor";

    // Log 1: Before using scope, with the parameter
    logger.LogInformation("Testing some log before using with the handlerName {Queue.HandlerName}", queueHandlerForLogs);

    // Create a scope with both simple and dot-separated parameter names
    using (logger.BeginScope(new Dictionary<string, object?>
    {
        { "Queue.HandlerName", queueHandlerForScope },
        { "SimpleParam", "SimpleValue" }
    }))
    {
        // Log 2: After using scope, with the same parameter name
        // BUG: This causes the property.Queue.HandlerName to be removed from Sentry
        logger.LogInformation("Testing some log after using with the handlerName {Queue.HandlerName}", queueHandlerForLogs);

        // Log 3: After using scope, without providing the parameter again
        // This should have the scope property present
        logger.LogInformation("Testing some log after using with no handlerName");

        // Log 4: Using simple parameter name with scope
        logger.LogInformation("Testing with simple param {SimpleParam}", "DifferentValue");
    }

    return Results.Ok(new
    {
        Message = "Logs sent to Sentry. Check Sentry dashboard to see the bug.",
        ExpectedBehavior = "Log 2 should have property.Queue.HandlerName set to 'JobProcessorFromScope'",
        ActualBehavior = "Log 2 has property.Queue.HandlerName removed by Sentry SDK",
        Impact = "Cannot filter/search logs by structured data properties when the same parameter name is used in both scope and log message"
    });
});

// Add another endpoint with more examples
app.MapGet("/test-detailed", (ILogger<Program> logger) =>
{
    logger.LogInformation("=== Starting detailed test ===");

    // Scenario 1: Simple parameter name
    using (logger.BeginScope(new Dictionary<string, object?>
    {
        { "UserId", "user-from-scope" }
    }))
    {
        logger.LogInformation("Logging with UserId {UserId}", "user-from-log");
        logger.LogInformation("Logging without providing UserId");
    }

    logger.LogInformation("=== Scenario 1 complete ===");

    // Scenario 2: Dot-separated parameter name (from issue)
    using (logger.BeginScope(new Dictionary<string, object?>
    {
        { "Queue.HandlerName", "ScopeHandler" }
    }))
    {
        logger.LogInformation("Handler is {Queue.HandlerName}", "LogHandler");
        logger.LogInformation("Handler from scope only");
    }

    logger.LogInformation("=== Scenario 2 complete ===");

    // Scenario 3: Multiple dot-separated parameters
    using (logger.BeginScope(new Dictionary<string, object?>
    {
        { "Request.Id", "req-123-scope" },
        { "Request.Method", "GET" }
    }))
    {
        logger.LogInformation("Processing request {Request.Id} with method {Request.Method}",
            "req-456-log", "POST");
    }

    logger.LogInformation("=== Test complete ===");

    return Results.Ok("Check Sentry for logged events");
});

app.Run();
