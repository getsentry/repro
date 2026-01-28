import * as SentryBun from "@sentry/bun";

// Initialize Sentry - set SENTRY_DSN environment variable before running
SentryBun.init({
  dsn: process.env.SENTRY_DSN || "",

  tracesSampleRate: 1.0,

  debug: true, // Enable debug to see what's happening

  integrations: [
    SentryBun.httpIntegration({disableIncomingRequestSpans: false})
  ],

});

console.log("✅ Sentry initialized");