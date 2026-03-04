export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: "800px" }}>
      <h1>Repro: sentry-javascript#19367</h1>
      <p>
        Next.js 16 Turbopack bundles <code>@opentelemetry/api</code> into
        separate chunks for the instrumentation hook and each route handler.
        This creates multiple module instances that share the global context
        manager via <code>Symbol.for()</code>, but have separate{" "}
        <code>ContextAPI</code> singletons. Under sustained traffic, the
        re-entrant <code>.with()</code> calls spiral into infinite recursion.
      </p>

      <h2>Routes</h2>
      <ul>
        <li>
          <a href="/api/otel-check">/api/otel-check</a> — Diagnostic endpoint
          that tests <code>context.with()</code> (single and 3-deep nested) and
          reports the state of the global OTel registry.
        </li>
        <li>
          <a href="/api/test">/api/test</a> — Realistic API route with nested{" "}
          <code>Sentry.startSpan()</code> calls simulating DB queries and
          external API calls.
        </li>
      </ul>

      <h2>Build-time evidence</h2>
      <p>
        Run <code>npm run check-otel-dedup</code> after building to see which
        chunks each route loads and confirm the duplication.
      </p>
    </main>
  );
}
