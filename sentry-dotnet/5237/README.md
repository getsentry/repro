# Reproduction for sentry-dotnet#5237

**Issue:** https://github.com/getsentry/sentry-dotnet/issues/5237

**SDK:** sentry-dotnet (BackpressureMonitor pattern — no SDK dependency needed)

## Description

`BackpressureMonitor.Dispose()` deadlocks on single-threaded targets (Unity WebGL). When `Dispose()` calls `_workerTask.Wait()`, it synchronously blocks the only available thread. The worker task's cancellation continuation is queued on that same thread and can never run — classic single-threaded deadlock.

This reproduction simulates Unity WebGL's single-threaded environment using a custom `SynchronizationContext` that only processes work when explicitly pumped (the same model as Unity's `UnitySynchronizationContext`).

## Steps to Reproduce

1. Build and run with Docker:
   ```bash
   docker build -t backpressure-deadlock .
   docker run --rm backpressure-deadlock
   ```

   Or with the .NET 8 SDK:
   ```bash
   dotnet run
   ```

## Expected Behavior

`Dispose()` completes promptly — the worker task observes cancellation and exits.

## Actual Behavior

```
=== BackpressureMonitor.Dispose() Deadlock Reproduction ===
Issue: https://github.com/getsentry/sentry-dotnet/issues/5237

Worker task started. Pumping single-threaded message loop...

  [BackpressureMonitor] Health check tick
--- Calling Dispose() pattern: Cancel + Wait ---
BackpressureMonitor.Dispose() calls:
    _cts.Cancel();
    _workerTask.Wait();  // ← blocks the only thread

BUG CONFIRMED: _workerTask.Wait() deadlocked!
The cancellation continuation is stuck in the SynchronizationContext
queue, but Wait() blocks the only thread that could process it.

On Unity WebGL (no timeout), unityInstance.Quit() never resolves
and the browser tab freezes indefinitely.

--- Workaround: set EnableBackpressureHandling = false on WebGL ---
--- Fix: use async dispose or avoid blocking Wait() ---
```

`_workerTask.Wait()` never returns (a 5-second timeout is used in the reproduction so it doesn't hang forever). On Unity WebGL there is no timeout — the browser tab freezes indefinitely.

## Root Cause

In [`BackpressureMonitor.Dispose()`](https://github.com/getsentry/sentry-dotnet/blob/main/src/Sentry/Internal/BackpressureMonitor.cs):

```csharp
public void Dispose()
{
    try
    {
        _cts.Cancel();
        _workerTask.Wait();   // ← blocks the only thread on WebGL
    }
    ...
}
```

The worker is started with `Task.Run(() => DoWorkAsync(_cts.Token))` and loops on `await Task.Delay(10s, ct)`.

On multi-threaded platforms (iOS, Android, Windows), `Task.Run` schedules on a real thread-pool worker. `_cts.Cancel()` cancels `Task.Delay`, the continuation runs on the thread pool, and `Wait()` returns.

On Unity WebGL (single-threaded emscripten), `Task.Run` schedules on the main thread. `Task.Delay`'s continuation is also scheduled on the main thread. When `Dispose()` calls `Wait()`, it blocks the main thread waiting for a continuation that can only run on the main thread.

## Workaround

Set `EnableBackpressureHandling = false` on WebGL:

```csharp
#if UNITY_WEBGL && !UNITY_EDITOR
options.EnableBackpressureHandling = false;
#endif
```

## Possible Fixes

1. Disable backpressure monitoring automatically on single-threaded platforms (WebAssembly)
2. Replace `_workerTask.Wait()` with a non-blocking pattern (e.g. fire-and-forget the cancellation)
3. Implement `IAsyncDisposable` and cascade async disposal up the chain

## Environment

- .NET: 8.0 (reproduction); .NET 2.1 / Unity 2021.3.x (original report)
- sentry-dotnet: 4.3.1 (regression since 4.0.0; 3.2.4 unaffected)
- Platform: Unity WebGL (IL2CPP, single-threaded emscripten)
