import * as Sentry from "@sentry/react-router";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
  debug: true, // Enable debug to see transaction names in console
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
