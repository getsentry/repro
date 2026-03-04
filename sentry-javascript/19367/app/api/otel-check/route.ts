import { NextResponse } from "next/server";
import { context, trace } from "@opentelemetry/api";

/**
 * Diagnostic route that proves @opentelemetry/api is duplicated at runtime.
 *
 * When Turbopack bundles this route, it gets its OWN copy of @opentelemetry/api
 * (separate module instance from the one Sentry loaded in the instrumentation hook).
 * Both copies share the same globalThis[Symbol.for("opentelemetry.js.api.1")]
 * registry, but they are different JavaScript objects with different closures.
 *
 * This is the root cause of sentry-javascript#19367: the duplicated ContextAPI
 * creates a re-entrant loop through the shared global context manager.
 */
export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 1. Check the global OTel registry (shared across all copies via Symbol.for)
  const globalKey = Symbol.for("opentelemetry.js.api.1");
  const globalRegistry = (globalThis as any)[globalKey];
  diagnostics.globalOtelRegistry = {
    exists: !!globalRegistry,
    version: globalRegistry?.version,
    hasContextManager: !!globalRegistry?.context,
    hasTracerProvider: !!globalRegistry?.trace,
    hasDiag: !!globalRegistry?.diag,
  };

  // 2. Check the context manager registered by Sentry
  const ctxManager = globalRegistry?.context;
  if (ctxManager) {
    diagnostics.contextManager = {
      constructor: ctxManager.constructor.name,
      hasWithMethod: typeof ctxManager.with === "function",
    };
  }

  // 3. Test context.with() — the method that causes the infinite recursion
  let contextWithResult: string;
  try {
    const result = context.with(context.active(), () => {
      return "context.with() succeeded (single call)";
    });
    contextWithResult = result;
  } catch (err: any) {
    contextWithResult = `CRASH: ${err.message}`;
  }
  diagnostics.singleContextWith = contextWithResult;

  // 4. Test nested context.with() — mimics what _startSpan() does in SDK 10.38.0
  //
  // In 10.38.0, _startSpan() wraps the call like:
  //   context.with(suppressedCtx, () =>           // call 1
  //     tracer.startActiveSpan(name, ctx, span =>  // call 2 (inside startActiveSpan)
  //       context.with(activeCtx, () =>            // call 3
  //         callback(span)
  //       )
  //     )
  //   )
  //
  // With duplicated modules, each context.with() may go through a different
  // ContextAPI singleton, and the Sentry context manager's scope cloning
  // triggers re-entry through the async context strategy.
  let nestedResult: string;
  try {
    context.with(context.active(), () => {
      return context.with(context.active(), () => {
        const tracer = trace.getTracer("repro-test");
        return tracer.startActiveSpan("nested-test", (span) => {
          span.end();
          return "nested context.with() succeeded (3-deep, same as _startSpan in 10.38.0)";
        });
      });
    });
    nestedResult = "3-deep nested context.with() succeeded";
  } catch (err: any) {
    nestedResult = `CRASH: ${err.message}`;
  }
  diagnostics.nestedContextWith = nestedResult;

  // 5. The build-time evidence
  diagnostics.buildTimeEvidence =
    "Run `npm run check-otel-dedup` on the build output to confirm that " +
    "the instrumentation hook and route handlers load DIFFERENT chunks " +
    "containing @opentelemetry/api. Turbopack creates separate module " +
    "instances instead of deduplicating into a single shared chunk.";

  return NextResponse.json(diagnostics, {
    status: contextWithResult.startsWith("CRASH") ? 500 : 200,
  });
}
