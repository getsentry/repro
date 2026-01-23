# Reproduction for sentry-ruby#2813

**Issue:** https://github.com/getsentry/sentry-ruby/issues/2813

## Description

This reproduction demonstrates that Sentry Ruby does not currently capture Puma queue time as a transaction attribute. Queue time is the duration a request waits in Puma's queue before being processed, which is a critical latency metric for Ruby/Rails applications.

When Puma receives a request, it may sit in a queue before a worker thread is available to process it. Puma (and reverse proxies like nginx) add headers like `X-Request-Start` or `X-Queue-Start` with timestamps marking when the request entered the queue. However, Sentry only begins instrumenting after Puma starts processing the request, missing this queue time entirely.

## How Queue Time Works

1. Request arrives at Puma → Header `X-Request-Start: t=1234567890123456` is added
2. Request waits in queue (this time is NOT captured by Sentry currently)
3. Puma worker picks up request → Sentry transaction starts here
4. Application processes request → Sentry measures this duration
5. Response sent

**Other APM tools** (Scout APM, Judoscale) extract this queue time from headers and report it separately, allowing teams to distinguish between:
- **Queue time** (infrastructure/capacity issue)
- **Processing time** (application code issue)

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

   Note: If you encounter permissions issues with system Ruby, consider using a Ruby version manager like `rbenv` or `asdf`, or install to a user directory:
   ```bash
   bundle install --path vendor/bundle
   ```

2. Set up Sentry DSN (optional - leave empty to just see console output):
   ```bash
   export SENTRY_DSN=""
   ```

3. Start the Puma server:
   ```bash
   bundle exec puma -C puma_config.rb
   ```

4. In another terminal, run the simulation script:
   ```bash
   ruby simulate_queue.rb
   ```

## Expected Behavior

The Sentry transaction should include queue time as an attribute or span, similar to how Scout APM and Judoscale capture it:

```ruby
# Expected transaction attributes:
{
  "queue_time_ms" => 500,  # or similar attribute name
  "started_at" => "2025-01-23T...",
  # ... other transaction data
}
```

This would allow developers to:
- Monitor queue time trends in Sentry Performance
- Alert on high queue times indicating capacity issues
- Distinguish between slow code vs insufficient infrastructure

## Actual Behavior

Sentry transactions only capture the time spent processing the request after Puma begins execution. The queue time is NOT captured, even though it's available in the `X-Request-Start` header.

Check the console output when running `simulate_queue.rb`:
- "Calculated queue time: ~500ms" shows the queue time IS available
- Sentry transaction data shows NO queue time attribute
- The transaction duration only includes processing time, not queue time

## Implementation References

Other Ruby APM tools successfully capture this metric:

1. **Scout APM**: [request_queue_time_converter.rb](https://github.com/scoutapp/scout_apm_ruby/blob/8234fb5678a2f67df8037f77de386b8ef7dfe8ac/lib/scout_apm/layer_converters/request_queue_time_converter.rb)
   - Checks multiple header variants: `X-Queue-Start`, `X-Request-Start`
   - Parses timestamp and calculates delta
   - Records as separate "QueueTime/Request" metric

2. **Judoscale**: [request_metrics.rb](https://github.com/judoscale/judoscale-ruby/blob/main/judoscale-ruby/lib/judoscale/request_metrics.rb)
   - Extracts `HTTP_X_REQUEST_START`
   - Subtracts `puma.request_body_wait` (network time) for accuracy
   - Handles multiple timestamp formats (seconds, milliseconds, microseconds, nanoseconds)

## Environment

- Ruby: 3.x+ (any recent version)
- Puma: ~> 6.0
- Sentry-Ruby: ~> 5.22
- OS: Any

## Proposed Solution

Sentry could capture queue time by:

1. In the Rack middleware, check for queue time headers before starting transaction:
   ```ruby
   QUEUE_HEADERS = %w[HTTP_X_QUEUE_START HTTP_X_REQUEST_START]
   ```

2. Parse timestamp from header value (format: `t=1234567890123456`)

3. Calculate queue duration: `Time.now - parsed_timestamp`

4. Attach as transaction attribute or create a separate span

5. Optionally subtract `puma.request_body_wait` for network time accuracy
