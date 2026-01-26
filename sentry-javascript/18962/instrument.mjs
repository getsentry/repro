import * as Sentry from '@sentry/node';

// Only initialize if ENABLE_SENTRY is set
if (process.env.ENABLE_SENTRY === 'true') {
  console.log('🔍 Initializing Sentry...');

  Sentry.init({
    dsn: process.env.SENTRY_DSN || '', // Empty DSN for testing
    environment: 'local',
    tracesSampleRate: 1.0,

    // Even with OpenAI integration filtered out, streaming still breaks
    integrations: (integrations) => {
      const filtered = integrations.filter((integration) => {
        const name = integration?.name ?? '';
        const normalized = name.toLowerCase();
        // Try to filter out OpenAI integration (as mentioned in the issue)
        return !normalized.includes('openai');
      });
      console.log('✅ Sentry initialized with integrations:', filtered.map(i => i.name).join(', '));
      return filtered;
    },
  });
} else {
  console.log('⏭️  Sentry disabled - streaming should work normally');
}
