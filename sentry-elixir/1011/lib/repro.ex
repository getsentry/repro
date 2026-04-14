defmodule Repro do
  @moduledoc """
  Reproduction for getsentry/sentry-elixir#1011

  Demonstrates that async child spans which start after the root span
  finishes are dropped by Sentry's SpanProcessor and never reported.
  """

  require OpenTelemetry.Tracer, as: Tracer

  def run do
    IO.puts("=== Reproduction: Async spans dropped by SpanProcessor ===\n")

    # Step 1: Create a root span that finishes quickly
    IO.puts("[1] Creating root span 'sync_root'...")

    parent_ctx =
      Tracer.with_span "sync_root" do
        IO.puts("    Root span started and finishing immediately.")
        :otel_ctx.get_current()
      end

    IO.puts("[2] Root span 'sync_root' has ended.")
    IO.puts("[3] Starting async Task that will create child spans...\n")

    # Step 2: Start an async task that creates child spans AFTER the root ends.
    # This simulates real-world patterns like Broadway consumers, Oban workers,
    # or Ecto queries triggered asynchronously from a web request.
    task =
      Task.async(fn ->
        # Small delay to ensure root span has fully completed
        Process.sleep(25)

        token = :otel_ctx.attach(parent_ctx)

        try do
          Tracer.with_span "async_parent" do
            IO.puts("    [async] 'async_parent' span started")

            Tracer.with_span "async_child" do
              IO.puts("    [async] 'async_child' span started")
              Process.sleep(10)
              IO.puts("    [async] 'async_child' span ending")
            end

            IO.puts("    [async] 'async_parent' span ending")
          end
        after
          :otel_ctx.detach(token)
        end
      end)

    Task.await(task)

    # Give the span processor time to flush
    Process.sleep(1000)

    IO.puts("""
    \n=== EXPECTED BEHAVIOR ===
      Two transactions reported with the same trace_id.
      The trace in Sentry should show 3 spans:
        - sync_root
          - async_parent
            - async_child

    === ACTUAL BEHAVIOR ===
      Only 'sync_root' is reported.
      'async_parent' and 'async_child' are silently dropped because
      their parent span is no longer in SpanStorage when they finish.

    === ROOT CAUSE ===
      Sentry.OpenTelemetry.SpanProcessor.process_span/1 looks up the
      parent span in SpanStorage. When the root span finishes first,
      it gets cleaned up from storage. The async child spans then
      can't find their parent and are dropped.

    Check your Sentry dashboard to confirm only 'sync_root' appears.
    The async spans will be missing from the trace.
    """)
  end
end
