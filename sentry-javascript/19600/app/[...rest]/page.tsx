// This catch-all route is key to reproducing the bug.
// When Turbopack is used with @sentry/nextjs, the /.well-known request
// hits this catch-all route, and Clerk's middleware detection fails.
export default function CatchAll() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Catch-all route</h1>
      <p>This page is rendered for all routes that don&apos;t match other pages.</p>
    </main>
  );
}
