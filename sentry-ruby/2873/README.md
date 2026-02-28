# Reproduction for sentry-ruby#2873

**Issue:** https://github.com/getsentry/sentry-ruby/issues/2873

## Description

`http.server.request.time_in_queue` is never captured in Rails apps because the
`Sentry::Rails::CaptureExceptions#start_transaction` method overrides the parent
`Sentry::Rack::CaptureExceptions#start_transaction` without including the queue
time capture logic added in [PR #2838](https://github.com/getsentry/sentry-ruby/pull/2838).

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

2. Run the reproduction:
   ```bash
   ruby test_queue_time.rb
   ```

## Expected Behavior

The `before_send_transaction` callback should show that `http.server.request.time_in_queue`
is present in the transaction data with a value of ~100ms.

## Actual Behavior

The output shows:
```
BUG: http.server.request.time_in_queue is MISSING
     The Rails CaptureExceptions#start_transaction
     overrides the Rack parent without queue time logic.
```

## Root Cause

- The Rack parent class (`sentry-ruby/lib/sentry/rack/capture_exceptions.rb`) calls
  `extract_queue_time(env)` at the end of `start_transaction` and sets the data on the transaction.
- The Rails subclass (`sentry-rails/lib/sentry/rails/capture_exceptions.rb`) completely
  overrides `start_transaction` without calling `super` or including the queue time logic.

## Environment
- Ruby: 4.0.1
- sentry-ruby: 6.4.0
- sentry-rails: 6.4.0
- Rails: ~> 8.0
