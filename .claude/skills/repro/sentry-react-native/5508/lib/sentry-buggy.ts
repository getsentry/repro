import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.SENTRY_DSN || 'YOUR_SENTRY_DSN_HERE';

/**
 * BUG: When Sentry.init() is the first statement after an early return guard,
 * events are silently dropped in production builds (Hermes bytecode).
 */
export function initializeSentryBuggy(): void {
  if (!SENTRY_DSN || SENTRY_DSN === 'YOUR_SENTRY_DSN_HERE') {
    return;
  }

  // No statement between the guard and Sentry.init() — this triggers the bug
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: true,
    tracesSampleRate: 1.0,
  });
}
