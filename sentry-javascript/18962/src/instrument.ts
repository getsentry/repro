// Sentry instrumentation file for NestJS
// This is loaded BEFORE the application starts via --import flag
import * as Sentry from "@sentry/nestjs";

if (process.env.ENABLE_SENTRY === "true") {
  console.log("🔍 Initializing Sentry with @sentry/nestjs...");

  Sentry.init({
    dsn: process.env.SENTRY_DSN || "",
    environment: "local",
    tracesSampleRate: 1.0,
    debug: true,
    sendDefaultPii: true,
  });

  console.log("✅ Sentry initialized");
} else {
  console.log("⏭️  Sentry disabled (ENABLE_SENTRY != true)");
}
