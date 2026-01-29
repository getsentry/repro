# Reproduction for sentry-php#1999

**Issue:** https://github.com/getsentry/sentry-php/issues/1999

## Description

The SDK incorrectly uses the `sentry-sample_rate` value from the baggage header to make a sampling decision when the `sentry-trace` header is missing. Without a `sentry-trace` header, the SDK should treat this as a new trace head and use the locally configured `traces_sample_rate` instead.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   composer install
   ```

2. Run the reproduction:
   ```bash
   php reproduce.php
   ```

## Expected Behavior

When there is no `sentry-trace` header, the SDK should make an independent sampling decision using the configured `traces_sample_rate` (0.0 in this case). The transaction should NOT be sampled.

## Actual Behavior

The SDK extracts the sample rate from the incoming baggage header (`sentry-sample_rate=1.0`) and uses it to determine whether to sample the transaction. The transaction IS sampled despite `traces_sample_rate=0.0`.

## Why This Matters

- The baggage sample rate reflects the sampling decision of an upstream service that may have different sampling configuration
- Without `sentry-trace`, there's no parent span to continue, so the local SDK should be the trace head
- This can lead to unexpected sampling behavior where traces are sampled at rates not configured locally

## Environment

- PHP: 8.x
- sentry/sentry: ^4.0
