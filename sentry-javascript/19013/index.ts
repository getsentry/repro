import * as SentryBun from "@sentry/bun";
import express from "express";

// Initialize Sentry - set SENTRY_DSN environment variable before running
SentryBun.init({
  dsn: process.env.SENTRY_DSN || "",

  tracesSampleRate: 1.0,

  debug: true, // Enable debug to see what's happening

  integrations: [
    SentryBun.captureConsoleIntegration({
      levels: ["error"],
    }),
  ],
});

const app = express();

// Middleware to log trace information for each request
app.use((req, res, next) => {
  const traceId = SentryBun.getActiveSpan()?.spanContext().traceId;
  const spanId = SentryBun.getActiveSpan()?.spanContext().spanId;

  console.log(`\n--- Request: ${req.method} ${req.path} ---`);
  console.log(`Trace ID: ${traceId || "NO TRACE ID"}`);
  console.log(`Span ID: ${spanId || "NO SPAN ID"}`);

  // Store trace ID in response header for easy verification
  if (traceId) {
    res.setHeader("X-Trace-Id", traceId);
  }

  next();
});

// Simple endpoint 1
app.get("/endpoint1", (req, res) => {
  const traceId = SentryBun.getActiveSpan()?.spanContext().traceId;
  res.json({
    endpoint: "endpoint1",
    traceId: traceId || "NO TRACE ID",
    message: "This is endpoint 1",
  });
});

// Simple endpoint 2
app.get("/endpoint2", (req, res) => {
  const traceId = SentryBun.getActiveSpan()?.spanContext().traceId;
  res.json({
    endpoint: "endpoint2",
    traceId: traceId || "NO TRACE ID",
    message: "This is endpoint 2",
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("\nTest the issue by making multiple requests:");
  console.log(`  curl http://localhost:${PORT}/endpoint1`);
  console.log(`  curl http://localhost:${PORT}/endpoint2`);
  console.log("\nExpected: Each request should have a DIFFERENT trace ID");
  console.log("Actual (bug): All requests share the SAME trace ID");
});
