import * as Sentry from "@sentry/react-router";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

if (process.env.SENTRY_DSN) {
  console.log("SENTRY_DSN is set, initializing Sentry");
} else {
  console.log("SENTRY_DSN is not set, skipping Sentry initialization");
}

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  integrations: [Sentry.reactRouterTracingIntegration()],
  tracesSampleRate: 1.0,
  debug: true,
  beforeSendTransaction(event) {
    const name = event.transaction;
    console.log(
      `[Sentry Transaction] name: "${name}", source: "${event.transaction_info?.source}"`,
      name === "[object Object]" ? " <-- BUG (issue #19580)" : ""
    );
    return event;
  },
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
