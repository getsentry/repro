import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.SENTRY_DSN || 'YOUR_SENTRY_DSN_HERE';

/**
 * WORKAROUND: Adding any statement before Sentry.init() prevents the bug.
 */
export function initializeSentryWorkaround(): void {
  if (!SENTRY_DSN || SENTRY_DSN === 'YOUR_SENTRY_DSN_HERE') {
    return;
  }

  // This console.log (or any statement) before Sentry.init() fixes the issue
  console.log('[Sentry] initializing...');

  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: true,
    tracesSampleRate: 1.0,
  });
}
