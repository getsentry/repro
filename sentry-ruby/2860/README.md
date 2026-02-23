# Reproduction for sentry-ruby#2860

**Issue:** https://github.com/getsentry/sentry-ruby/issues/2860

## Description

When a Sidekiq job is pushed to Redis without a `"retry"` field in the message payload (e.g., from an external system like AWS Lambda), Sentry's error handler considers the job as non-retryable and immediately reports the error.

However, Sidekiq defaults to `retry: true` (25 retries) when the field is not specified. Before executing a job, Sidekiq resolves the missing `retry` from the job class options (in `processor.rb`):

```ruby
if msg["retry"].nil?
  msg["retry"] = jobinst.class.get_sidekiq_options["retry"]
end
```

Since `retry` defaults to `true` in `sidekiq_options`, a missing `retry` in the payload should be treated as retryable.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

2. Run the reproduction:
   ```bash
   export SENTRY_DSN=<your-dsn>  # optional, works without it
   bundle exec ruby repro.rb
   ```

## Expected Behavior

- Scenario 1 (payload has `retry: true`): PASS — not reported
- Scenario 2 (payload missing `retry` key): PASS — not reported (Sidekiq defaults to `retry: true`)
- Scenario 3 (payload has `retry: false`): PASS — reported (explicitly non-retryable)

## Actual Behavior

Scenario 2 shows `FAIL` — Sentry reports the error prematurely because it sees `nil` for `retry` in the payload and treats it as non-retryable.

## Root Cause

In [`sentry-sidekiq/lib/sentry/sidekiq/error_handler.rb`](https://github.com/getsentry/sentry-ruby/blob/master/sentry-sidekiq/lib/sentry/sidekiq/error_handler.rb), the `retryable?` method only checks the payload's `retry` value:

```ruby
def retryable?(context)
  retry_option = context.dig(:job, "retry")
  retry_option == true || (retry_option.is_a?(Integer) && retry_option.positive?)
end
```

When `retry` is `nil` (missing from payload), this returns `false`. But Sidekiq defaults to `retry: true` (25 retries) when not specified. The comment on line 63 even acknowledges this but the code doesn't handle it. The fix is to treat `nil` as retryable:

```ruby
def retryable?(context)
  retry_option = context.dig(:job, "retry")
  # when `retry` is not specified, it's default is `true` and it means 25 retries.
  retry_option.nil? || retry_option == true || (retry_option.is_a?(Integer) && retry_option.positive?)
end
```

## Environment

- Ruby: 3.3.x
- sidekiq: ~> 7.3
- sentry-ruby: ~> 5.22
- sentry-sidekiq: ~> 5.22
