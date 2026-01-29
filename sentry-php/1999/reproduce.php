<?php

require_once __DIR__ . '/vendor/autoload.php';

use Sentry\SentrySdk;
use Sentry\Tracing\TransactionContext;

// Initialize Sentry with a low sample rate to demonstrate the bug
\Sentry\init([
    'dsn' => getenv('SENTRY_DSN') ?: null,
    'traces_sample_rate' => 0.0, // Local config: 0% sampling - should NEVER sample
]);

// Simulate incoming request with baggage header but NO sentry-trace header
// This represents a scenario where:
// - An upstream service sent baggage with sample_rate=1.0 (100% sampling)
// - But the sentry-trace header is missing (e.g., stripped by a proxy)
$_SERVER['HTTP_BAGGAGE'] = 'sentry-sample_rate=1.0,sentry-sampled=true,sentry-trace_id=12345678901234567890123456789012,sentry-public_key=abc123';

// Note: HTTP_SENTRY_TRACE is intentionally NOT set

$hub = SentrySdk::getCurrentHub();
$client = $hub->getClient();

// Create a transaction context from the incoming headers
// Since there's no sentry-trace header, this should be treated as a new trace head
$context = TransactionContext::fromHeaders(
    $_SERVER['HTTP_SENTRY_TRACE'] ?? '',
    $_SERVER['HTTP_BAGGAGE'] ?? ''
);

$context->setName('test-transaction');
$context->setOp('http.server');

$transaction = $hub->startTransaction($context);

echo "=== Reproduction for sentry-php#1999 ===\n\n";
echo "Configuration:\n";
echo "  traces_sample_rate: 0.0 (0% - should never sample)\n\n";

echo "Incoming Headers:\n";
echo "  sentry-trace: (not present)\n";
echo "  baggage: sentry-sample_rate=1.0,sentry-sampled=true,...\n\n";

echo "Result:\n";
echo "  Transaction sampled: " . ($transaction->getSampled() ? 'YES' : 'NO') . "\n\n";

if ($transaction->getSampled()) {
    echo "BUG CONFIRMED: Transaction was sampled despite traces_sample_rate=0.0\n";
    echo "The SDK incorrectly used the baggage sample_rate (1.0) instead of the local config.\n";
} else {
    echo "Expected behavior: Transaction was not sampled (respecting local config).\n";
}

$transaction->finish();
