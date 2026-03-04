import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * Simulates a realistic API route that creates nested Sentry spans.
 *
 * In production, auto-instrumentation (HTTP, Prisma, etc.) creates spans
 * around every request and DB query. Each Sentry.startSpan() call in 10.38.0
 * internally calls context.with() THREE times (suppressed ctx → startActiveSpan
 * → active ctx). With Turbopack's duplicate @opentelemetry/api modules, this
 * 3-deep nesting × N nested spans can spiral into infinite recursion.
 *
 * The crash is intermittent because it depends on Node.js event loop timing
 * and which module copy's ContextAPI handles each context.with() call.
 */
export async function GET() {
  // Outer span — simulates the HTTP instrumentation auto-span
  return Sentry.startSpan({ name: "GET /api/test" }, async () => {
    // Inner span — simulates a DB query (e.g., Prisma)
    const dbResult = await Sentry.startSpan(
      { name: "prisma:query SELECT" },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 2));
        return { users: 42 };
      }
    );

    // Another inner span — simulates a second DB query
    const cacheResult = await Sentry.startSpan(
      { name: "redis:get session" },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return { cached: true };
      }
    );

    // Deeply nested span — simulates calling an external API
    const apiResult = await Sentry.startSpan(
      { name: "http:POST /external-api" },
      async () => {
        // Nested span inside the external call
        return Sentry.startSpan(
          { name: "serialize:response" },
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 1));
            return { ok: true };
          }
        );
      }
    );

    return NextResponse.json({
      status: "ok",
      dbResult,
      cacheResult,
      apiResult,
      timestamp: Date.now(),
    });
  });
}
