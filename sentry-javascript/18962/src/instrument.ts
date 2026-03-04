import * as Sentry from "@sentry/nestjs";

if (process.env.ENABLE_SENTRY === "true") {
  console.log("Initializing Sentry...");

  Sentry.init({
    dsn: process.env.SENTRY_DSN || "",
    environment: "local",
    // This is the key setting that breaks streaming.
    // Removing tracesSampleRate (or setting it to 0) fixes the issue.
    tracesSampleRate: 1.0,
  });

  console.log("Sentry initialized with tracesSampleRate: 1.0");
} else {
  console.log("Sentry disabled (ENABLE_SENTRY != true)");
}
