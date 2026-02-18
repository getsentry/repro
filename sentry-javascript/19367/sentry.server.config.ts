import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 1,
  integrations: [
    // prismaIntegration triggers @prisma/instrumentation which registers OTel instrumentations.
    // Combined with Turbopack's chunk splitting, this leads to two copies of @opentelemetry/api
    // whose .with() methods recursively call each other → RangeError: Maximum call stack size exceeded.
    Sentry.prismaIntegration(),
  ],
});
