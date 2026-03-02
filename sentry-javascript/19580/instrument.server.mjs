import * as Sentry from "@sentry/react-router";

if (process.env.SENTRY_DSN) {
  console.log("SENTRY_DSN is set, initializing Sentry");
} else {
  console.log("SENTRY_DSN is not set, skipping Sentry initialization");
}

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 1.0,
  debug: false,
});
