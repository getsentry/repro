import express from "express";
import * as SentryBun from "@sentry/bun";

import { subscribe } from "node:diagnostics_channel";
import http from "node:http";

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
  SentryBun.startSpan(
    {
      name: "endpoint1",
    },
    () => {
      const traceId = SentryBun.getActiveSpan()?.spanContext().traceId;
      res.json({
        endpoint: "endpoint1",
        traceId: traceId || "NO TRACE ID",
        message: "This is endpoint 1",
      });
    }
  );
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

subscribe("http.server.request.start", (message, name) => {
  console.warn("http.server.request: ", message, name);
});

subscribe("http.client.request.start", (message, name) => {
  console.warn("http.client.request: ", message, name);
});

const PORT = process.env.PORT || 3001;

app.use(SentryBun.expressErrorHandler());

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("\nTest the issue by making multiple requests:");
  console.log(`  curl http://localhost:${PORT}/endpoint1`);
  console.log(`  curl http://localhost:${PORT}/endpoint2`);
  console.log("\nExpected: Each request should have a DIFFERENT trace ID");
  console.log("Actual (bug): All requests share the SAME trace ID");
});
