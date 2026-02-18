import { NextResponse } from "next/server";

// This route triggers OTel context propagation on every request.
// With @sentry/nextjs 10.38.0 + Next.js 16 Turbopack, @opentelemetry/api ends up
// bundled in two separate chunks. Each chunk's ContextAPI.with() delegates to the
// other copy's with(), creating infinite mutual recursion →
// RangeError: Maximum call stack size exceeded
export async function GET() {
  // Simulate a minimal workload so Sentry/OTel creates spans
  const start = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 1));

  return NextResponse.json({
    status: "ok",
    timestamp: Date.now(),
    duration: Date.now() - start,
  });
}
