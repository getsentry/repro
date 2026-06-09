require "yabeda"

WITH_SENTRY = ENV.key?("SENTRY_DSN")

if WITH_SENTRY
  require "sentry-ruby"
  require "sentry-yabeda"
end

Yabeda.configure do
  group :rails do
    counter :requests_total, tags: %i[controller action status format method]
    histogram :request_duration, tags: %i[controller action status format method],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  end

  group :active_record do
    counter :instantiation_total, tags: %i[kind]
    histogram :sql_query_duration, tags: %i[kind cached async],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
  end

  group :http do
    counter :request_total, tags: %i[host method port]
    histogram :request_duration, tags: %i[host method port],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
  end

  group :activejob do
    counter :executed_total, tags: %i[queue job executions]
    counter :failed_total, tags: %i[queue job executions failure_reason]
  end
end

Yabeda.configure!

if WITH_SENTRY
  Sentry.init do |config|
    config.dsn = ENV.fetch("SENTRY_DSN")
    config.enable_metrics = true
    config.enable_logs = true
    config.enabled_patches = %i[logger]
  end
end

CONTROLLERS = %w[users posts comments orders products sessions search admin api webhooks]
ACTIONS = %w[index show create update destroy]
STATUSES = %w[200 201 301 302 400 401 403 404 422 500]
FORMATS = %w[html json]
HTTP_METHODS = %w[GET POST PUT PATCH DELETE]

AR_KINDS = 20.times.map { |i| "Model#{i} Load" } +
           20.times.map { |i| "Model#{i} Create" } +
           10.times.map { |i| "Model#{i} Update" }

JOBS = %w[EmailJob ProcessingJob CleanupJob SyncJob NotificationJob ReportJob ImportJob ExportJob]
QUEUES = %w[default mailers low_priority high_priority]
FAILURE_REASONS = %w[RuntimeError TimeoutError ConnectionError ActiveRecord::RecordNotFound Net::ReadTimeout]

def total_yabeda_values
  Yabeda.metrics.values.sum { |m| m.values.size }
end

def rss_kb
  `ps -o rss= -p #{Process.pid}`.strip.to_i
end

# ── Part 1: Hash mutation proof ──────────────────────────────────────────────
if WITH_SENTRY
  puts "=" * 80
  puts "Part 1: Proving Scope#apply_to_telemetry mutates yabeda's tag hash in-place"
  puts "=" * 80
  puts

  test_counter = Yabeda.metrics.values.find { |m| m.name == :instantiation_total }
  labels = { kind: "TestModel Load" }

  5.times { Yabeda.active_record_instantiation_total.increment({ kind: "TestModel Load" }) }

  puts "After 5 identical increments of {kind: 'TestModel Load'}:"
  puts "  values.size = #{test_counter.values.size}  (expected: 1, got: #{test_counter.values.size})"
  puts
  puts "Sample stored keys (should all be identical, but each call creates a new entry"
  puts "because Scope#apply_to_telemetry mutates the hash AFTER it's stored as a key):"
  test_counter.values.keys.first(3).each_with_index do |k, i|
    puts "  [#{i}] #{k.inspect}"
  end
  puts
  puts "The call chain:"
  puts "  1. Yabeda::Tags.build returns {kind: 'TestModel Load'}"
  puts "  2. Yabeda stores this hash as a key in metric.values (Concurrent::Hash)"
  puts "  3. sentry-yabeda adapter passes the SAME hash object to Sentry.metrics.count"
  puts "  4. MetricEvent stores it as @attributes (no copy)"
  puts "  5. Scope#apply_to_telemetry calls @attributes['sentry.sdk.name'] = ..."
  puts "  6. This mutates the hash that's already a key in yabeda's values hash"
  puts "  7. The key's hash code changes, so future lookups can never find it"
  puts "  8. Every increment creates a new orphaned entry → unbounded memory growth"
  puts
end

# ── Part 2: Memory growth at scale ──────────────────────────────────────────
puts "=" * 80
mode = WITH_SENTRY ? "yabeda + sentry-yabeda" : "yabeda only"
puts "Part 2: Memory growth at scale (#{mode})"
puts "=" * 80
puts

GC.start(full_mark: true, immediate_sweep: true)
GC.compact if GC.respond_to?(:compact)

initial_rss = rss_kb
initial_live = GC.stat[:heap_live_slots]

puts "Initial: RSS=%d KB, live_slots=%d" % [initial_rss, initial_live]
puts
puts "%5s  %8s  %8s  %8s  %8s  %8s" % %w[Round RSS +RSS LiveSlots OldObjs Values]
puts "-" * 60

host_pool_size = 0

20.times do |round|
  50.times do
    labels = {
      controller: CONTROLLERS.sample,
      action: ACTIONS.sample,
      status: STATUSES.sample,
      format: FORMATS.sample,
      method: HTTP_METHODS.sample
    }
    Yabeda.rails_requests_total.increment(labels)
    Yabeda.rails_request_duration.measure(labels, rand * 2.0)
  end

  100.times do
    kind = AR_KINDS.sample
    Yabeda.active_record_instantiation_total.increment({ kind: kind })
    Yabeda.active_record_sql_query_duration.measure(
      { kind: kind, cached: [true, false].sample, async: [true, false].sample },
      rand * 0.1
    )
  end

  host_pool_size += 20
  hosts = host_pool_size.times.map { |i| "api-#{i}.tenant.example.com" }
  30.times do
    labels = { host: hosts.sample, method: %w[GET POST].sample, port: [80, 443].sample }
    Yabeda.http_request_total.increment(labels)
    Yabeda.http_request_duration.measure(labels, rand * 0.5)
  end

  20.times do
    base = { queue: QUEUES.sample, job: JOBS.sample, executions: rand(1..3).to_s }
    Yabeda.activejob_executed_total.increment(base)
    if rand < 0.1
      Yabeda.activejob_failed_total.increment(base.merge(failure_reason: FAILURE_REASONS.sample))
    end
  end

  sleep 1 if WITH_SENTRY

  GC.start(full_mark: true, immediate_sweep: true)

  puts "%5d  %6d KB  %+6d  %8d  %8d  %8d" % [
    round + 1,
    rss_kb, rss_kb - initial_rss,
    GC.stat[:heap_live_slots],
    GC.stat[:old_objects],
    total_yabeda_values
  ]
end

puts
puts "=" * 80
puts "Final: RSS=%d KB (%+d), live_slots=%d (%+d), yabeda_values=%d" % [
  rss_kb, rss_kb - initial_rss,
  GC.stat[:heap_live_slots], GC.stat[:heap_live_slots] - initial_live,
  total_yabeda_values
]
puts
puts "Per-metric breakdown:"
Yabeda.metrics.each do |name, metric|
  next if metric.values.empty?
  puts "  %-45s %d unique tag combos" % [name, metric.values.size]
end

if WITH_SENTRY
  puts
  puts "NOTE: With sentry-yabeda, every metric increment creates a new entry in"
  puts "yabeda's values hash (even for identical tags) because Sentry's"
  puts "Scope#apply_to_telemetry mutates the hash key after insertion."
  puts "Without sentry-yabeda, growth is bounded by the Cartesian product of tag values."
  Sentry.close rescue nil
end
