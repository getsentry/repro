export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Repro: sentry-javascript#19367</h1>
      <p>
        Next.js 16 + Turbopack duplicates <code>@opentelemetry/api</code> across
        chunks, causing infinite <code>.with()</code> recursion.
      </p>
      <p>
        Hit the <a href="/api/test">/api/test</a> endpoint repeatedly (or under
        load) to trigger OTel context propagation. The server may crash with{" "}
        <code>RangeError: Maximum call stack size exceeded</code>.
      </p>
      <p>
        Run <code>npm run check-otel-dedup</code> after building to detect
        duplicate <code>@opentelemetry/api</code> chunks in the output.
      </p>
    </main>
  );
}
