import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://test@test.ingest.sentry.io/123',
  // Use default integrations which include linkedErrors for exception grouping
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
  // Disable sending to Sentry for local testing
  beforeSend(event) {
    console.log('\n--- Sentry Event ---');
    console.log('Exception values:');
    event.exception?.values?.forEach((exc, i) => {
      console.log(`  [${i}] type: ${exc.type}`);
      console.log(`       is_exception_group: ${exc.mechanism?.is_exception_group}`);
      console.log(`       parent_id: ${exc.mechanism?.parent_id}`);
      console.log(`       exception_id: ${exc.mechanism?.exception_id}`);
    });
    // Return null to prevent sending when no real DSN is configured
    if (!process.env.SENTRY_DSN) {
      return null;
    }
    return event;
  },
});

// Custom AggregateError class with a different name property
// This is common practice to differentiate error types by domain/source
class CustomAggregateError extends AggregateError {
  constructor(errors, message, options) {
    super(errors, message, options);
    this.name = 'CustomAggregateError';
  }
}

// --- Test 1: Standard AggregateError (works correctly) ---
console.log('=== Test 1: Standard AggregateError ===');
console.log('Creating AggregateError with name="AggregateError"');

const standardAggregate = new AggregateError(
  [new Error('error 1'), new Error('error 2')],
  'standard aggregate error'
);

Sentry.captureException(standardAggregate);

// --- Test 2: Custom AggregateError (BUG - not detected as exception group) ---
console.log('\n=== Test 2: CustomAggregateError ===');
console.log('Creating CustomAggregateError with name="CustomAggregateError"');
console.log('BUG: This should be detected as an exception group but is NOT');

const customAggregate = new CustomAggregateError(
  [
    new Error('error 1', { cause: new Error('error 1 cause') }),
    new Error('error 2'),
  ],
  'custom aggregate error',
  { cause: new Error('aggregate cause') }
);

console.log(`\nError instanceof AggregateError: ${customAggregate instanceof AggregateError}`);
console.log(`Error name: ${customAggregate.name}`);
console.log(`Error has 'errors' property: ${Array.isArray(customAggregate.errors)}`);

Sentry.captureException(customAggregate);

// Flush to ensure events are sent
await Sentry.flush(2000);

console.log('\n=== Summary ===');
console.log('Expected: Both errors should have is_exception_group: true');
console.log('Actual: Only the standard AggregateError has is_exception_group: true');
console.log('\nThe issue is that Sentry checks error.name === "AggregateError"');
console.log('instead of error instanceof AggregateError');
