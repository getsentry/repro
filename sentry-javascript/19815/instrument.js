import * as Sentry from '@sentry/node';

Sentry.init({
  // Set your DSN here: export SENTRY_DSN=https://...
  dsn: process.env.SENTRY_DSN,
  // Tracing is intentionally disabled (no tracesSampleRate)
  beforeSend(event) {
    const traceId = event.contexts?.trace?.trace_id;
    console.log(`[beforeSend] event type: error | trace_id: ${traceId}`);
    return event;
  },
  beforeSendTransaction(event) {
    const traceId = event.contexts?.trace?.trace_id;
    console.log(`[beforeSend] event type: transaction | trace_id: ${traceId}`);
    return event;
  },
});
