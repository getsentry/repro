# Reproduction for sentry-ruby#2857

**Issue:** https://github.com/getsentry/sentry-ruby/issues/2857

## Description

Metrics sent via `Sentry::Metrics.distribution` (or any metric method) are always dropped by Relay with a "No Data" reason. The root cause is that `MetricEvent#to_h` serializes the timestamp as a raw `Time` object, which becomes a string like `"2026-02-18 21:54:48 UTC"` in JSON. Relay expects a numeric Unix timestamp like `1771453701.042`.

`LogEvent#to_h` already handles this correctly by calling `.to_f` on the timestamp.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

2. Run the reproduction:
   ```bash
   bundle exec ruby repro.rb
   ```

## Expected Behavior

`MetricEvent#to_h` should return a numeric timestamp (like `LogEvent` does), so Relay can parse and accept metrics.

## Actual Behavior

`MetricEvent#to_h` returns a `Time` object for the timestamp, which serializes to a string in JSON. Relay cannot parse this format and drops all metrics with "No Data" reason.

```
MetricEvent timestamp => "2026-02-23 11:56:29 UTC" (String in JSON)
LogEvent timestamp    => 1771847789.1416361         (Float in JSON)
```

## Root Cause

In `sentry-ruby` v6.3.1, `MetricEvent#to_h` (line 36 of `lib/sentry/metric_event.rb`):
```ruby
timestamp: @timestamp      # Raw Time object -> becomes string in JSON
```

Should be:
```ruby
timestamp: @timestamp.to_f  # Numeric Unix timestamp (same as LogEvent)
```

## Environment

- Ruby: 3.3+
- sentry-ruby: 6.3.1
