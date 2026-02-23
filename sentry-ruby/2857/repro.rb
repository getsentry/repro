require "sentry-ruby"
require "json"

puts "=== Sentry Ruby SDK v#{Sentry::VERSION} - Metric Timestamp Bug Reproduction ==="
puts ""

# ---- Part 1: Show the root cause ----
# Sentry.utc_now returns a Time object. When serialized to JSON,
# Time#to_json produces a string like "2026-02-18 21:54:48 UTC".
# Relay expects a numeric Unix timestamp like 1771453701.042.

now = Sentry.utc_now
puts "Sentry.utc_now        => #{now.inspect}"
puts "  .to_s   (string)    => #{now.to_s.inspect}"
puts "  .to_f   (numeric)   => #{now.to_f}"
puts "  .to_json            => #{now.to_json}"
puts ""

# ---- Part 2: Compare MetricEvent vs LogEvent serialization ----
# MetricEvent uses `timestamp: @timestamp` (raw Time object)
# LogEvent uses `timestamp: timestamp.to_f` (numeric)

puts "--- MetricEvent serialization ---"
metric = Sentry::MetricEvent.new(
  name: "test_metric",
  type: :distribution,
  value: 20.0,
  unit: "kilobyte"
)
metric_hash = metric.to_h
puts "  MetricEvent#to_h[:timestamp] => #{metric_hash[:timestamp].inspect} (#{metric_hash[:timestamp].class})"
metric_json = metric_hash.to_json
puts "  JSON payload timestamp       => #{JSON.parse(metric_json)["timestamp"].inspect}"
puts ""

puts "--- LogEvent serialization (correct behavior) ---"
log = Sentry::LogEvent.new(level: :info, body: "test log")
log_hash = log.to_h
puts "  LogEvent#to_h[:timestamp]    => #{log_hash[:timestamp].inspect} (#{log_hash[:timestamp].class})"
log_json = log_hash.to_json
puts "  JSON payload timestamp       => #{JSON.parse(log_json)["timestamp"].inspect}"
puts ""

# ---- Part 3: Show the bug ----
puts "=== BUG CONFIRMED ==="
puts ""
puts "MetricEvent timestamp is a #{metric_hash[:timestamp].class} (\"#{metric_hash[:timestamp]}\")"
puts "LogEvent timestamp is a #{log_hash[:timestamp].class} (#{log_hash[:timestamp]})"
puts ""
puts "When MetricEvent is serialized to JSON and sent to Relay,"
puts "the timestamp becomes a string that Relay cannot parse."
puts "This causes ALL metrics to be dropped with 'No Data' reason."
puts ""
puts "Fix: In MetricEvent#to_h, change:"
puts "  timestamp: @timestamp"
puts "To:"
puts "  timestamp: @timestamp.to_f"
puts "(Same as LogEvent already does)"
