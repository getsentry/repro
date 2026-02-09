var builder = WebApplication.CreateBuilder(args);

// Configure Sentry as described in the issue
builder.WebHost.UseSentry(o =>
{
    //o.TracesSampleRate = 1.0;
    // Add any other configuration options
    o.TracesSampler = context =>
    {
        return 1.0;
    };
    o.SetBeforeSend((@event, hint) =>
    {
        // Never report server names
        Console.WriteLine(@event.User.Id);
        return @event;
    });
    o.Debug = true;
});

var app = builder.Build();

app.MapGet("/", () => "Hello World!");

app.Run();
