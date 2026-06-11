using System.Collections.Concurrent;

// =============================================================================
// Reproduction for sentry-dotnet#5237
// BackpressureMonitor.Dispose() deadlocks on single-threaded targets (Unity WebGL)
//
// Simulates Unity WebGL's single-threaded environment using a custom
// SynchronizationContext that only processes work when explicitly pumped.
// On Unity WebGL there is no real thread pool — Task.Run and Task.Delay
// continuations all run on the main thread. When Dispose() calls
// _workerTask.Wait(), it blocks the only thread that could process the
// task's cancellation continuation → classic deadlock.
// =============================================================================

Console.WriteLine("=== BackpressureMonitor.Dispose() Deadlock Reproduction ===");
Console.WriteLine("Issue: https://github.com/getsentry/sentry-dotnet/issues/5237\n");

// --- Install a single-threaded SynchronizationContext ---
// On Unity WebGL, the runtime uses UnitySynchronizationContext which posts
// all work (including Task.Run and await continuations) to the main thread.
var syncCtx = new SingleThreadSynchronizationContext();
SynchronizationContext.SetSynchronizationContext(syncCtx);

var cts = new CancellationTokenSource();

// BackpressureMonitor constructor: _workerTask = Task.Run(() => DoWorkAsync(_cts.Token));
// On Unity WebGL, Task.Run schedules on the main thread (no real thread pool).
// We simulate this with TaskScheduler.FromCurrentSynchronizationContext().
var scheduler = TaskScheduler.FromCurrentSynchronizationContext();
var workerTask = Task.Factory.StartNew(
    () => DoWorkAsync(cts.Token),
    cts.Token,
    TaskCreationOptions.None,
    scheduler
).Unwrap();

Console.WriteLine("Worker task started. Pumping single-threaded message loop...\n");

// Simulate Unity's main loop: pump the sync context so the worker can run
var pumpDeadline = DateTime.UtcNow.AddSeconds(2);
while (DateTime.UtcNow < pumpDeadline)
{
    syncCtx.RunPending();
    Thread.Sleep(50);
}

Console.WriteLine("--- Calling Dispose() pattern: Cancel + Wait ---");
Console.WriteLine("BackpressureMonitor.Dispose() calls:");
Console.WriteLine("    _cts.Cancel();");
Console.WriteLine("    _workerTask.Wait();  // ← blocks the only thread\n");

// BackpressureMonitor.Dispose():
//   _cts.Cancel();        → cancels the Task.Delay, queues the continuation
//   _workerTask.Wait();   → blocks the main thread waiting for a continuation
//                            that can only run on the main thread → DEADLOCK
cts.Cancel();

if (!workerTask.Wait(TimeSpan.FromSeconds(5)))
{
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine("BUG CONFIRMED: _workerTask.Wait() deadlocked!");
    Console.WriteLine("The cancellation continuation is stuck in the SynchronizationContext");
    Console.WriteLine("queue, but Wait() blocks the only thread that could process it.");
    Console.WriteLine("\nOn Unity WebGL (no timeout), unityInstance.Quit() never resolves");
    Console.WriteLine("and the browser tab freezes indefinitely.");
    Console.ResetColor();
    Console.WriteLine();

    // Show the fix
    Console.ForegroundColor = ConsoleColor.Green;
    Console.WriteLine("--- Workaround: set EnableBackpressureHandling = false on WebGL ---");
    Console.WriteLine("--- Fix: use async dispose or avoid blocking Wait() ---");
    Console.ResetColor();

    Environment.Exit(1);
}
else
{
    Console.ForegroundColor = ConsoleColor.Green;
    Console.WriteLine("No deadlock (task completed). This is unexpected for this reproduction.");
    Console.ResetColor();
    Environment.Exit(0);
}

// Replicates BackpressureMonitor.DoWorkAsync exactly
static async Task DoWorkAsync(CancellationToken cancellationToken)
{
    try
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            Console.WriteLine("  [BackpressureMonitor] Health check tick");

            // Original code:
            //   await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken)
            //       .ConfigureAwait(false);
            //
            // On Unity WebGL, ConfigureAwait(false) is a no-op because there IS
            // no other thread for the continuation to run on. All continuations
            // must run on the main thread regardless.
            //
            // In this reproduction we omit ConfigureAwait(false) to get the same
            // effect: the continuation is posted back to our custom
            // SynchronizationContext, which requires the main thread to pump it.
            await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);
        }
    }
    catch (OperationCanceledException)
    {
        Console.WriteLine("  [BackpressureMonitor] Cancellation received");
    }
}

/// <summary>
/// Simulates Unity WebGL's single-threaded environment. All work posted via
/// Post() is queued and only processed when RunPending() is called on the
/// main thread — exactly like Unity's UnitySynchronizationContext.
/// </summary>
class SingleThreadSynchronizationContext : SynchronizationContext
{
    private readonly ConcurrentQueue<(SendOrPostCallback Callback, object? State)> _queue = new();

    public override void Post(SendOrPostCallback d, object? state)
    {
        _queue.Enqueue((d, state));
    }

    public override void Send(SendOrPostCallback d, object? state)
    {
        d(state);
    }

    public void RunPending()
    {
        while (_queue.TryDequeue(out var item))
        {
            item.Callback(item.State);
        }
    }
}
