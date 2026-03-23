import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

export const handleError = Sentry.handleErrorWithSentry();
export const handle = Sentry.sentryHandle();
