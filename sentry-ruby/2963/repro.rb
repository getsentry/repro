require "sentry-ruby"
require "sentry-yabeda"
require "yabeda/http_requests"

# End-to-end reproduction of the re-entrancy deadlock in Sentry's
# TelemetryEventBuffer when Yabeda HTTP instrumentation is active.
#
# Nothing here is simulated. `sentry-yabeda` registers a real Yabeda adapter
# that forwards every Yabeda metric into Sentry.metrics, and `yabeda-http_requests`
# patches Net::HTTP to record a metric on every outgoing request. The flush's own
# HTTP POST therefore re-enters the metrics API:
#
#   Sentry.metrics.count(...)
#     → MetricEventBuffer#flush → @mutex.synchronize → send_items
#       → HTTPTransport#send_data → Net::HTTP POST   (to Sentry ingest)
#         → sniffer patch on Net::HTTP fires
#           → Yabeda::HttpRequests::Sniffer#request
#             → Yabeda.http_request_total.increment
#               → Sentry::Yabeda::Adapter#perform_counter_increment!
#                 → Sentry.metrics.count("http.request_total")
#                   → MetricEventBuffer#add_item → @mutex.synchronize → DEADLOCK
#
# Ruby's Mutex is non-reentrant, so the flush thread re-locking the mutex it
# already holds raises `ThreadError: deadlock; recursive locking`.
#
# Set SENTRY_DSN to a real DSN so the flush performs an actual HTTP POST, which
# is what triggers the Yabeda Net::HTTP instrumentation.

# Register the Yabeda metrics declared by yabeda-http_requests with the adapters.
Yabeda.configure!

Sentry.init do |config|
  config.dsn = ENV.fetch("SENTRY_DSN")
  config.enable_logs = true
  config.enable_metrics = true
  config.enabled_patches = %i[logger]
  config.sdk_logger.level = Logger::DEBUG
end

GC.start
initial_rss = `ps -o rss= -p #{Process.pid}`.strip.to_i
initial_live = GC.stat[:heap_live_slots]

puts "Reproducing deadlock and memory growth from re-entrant metric emission."
puts "Initial RSS: #{initial_rss} KB, live slots: #{initial_live}"
puts

10.times do |round|
  500.times { Sentry.metrics.count("repro.counter", value: 1) }
  sleep 6

  GC.start(full_mark: true, immediate_sweep: true)
  current_rss = `ps -o rss= -p #{Process.pid}`.strip.to_i
  live = GC.stat[:heap_live_slots]
  puts "Round %2d: RSS=%6d KB (%+6d), live_slots=%d (%+d)" % [
    round + 1, current_rss, current_rss - initial_rss, live, live - initial_live
  ]
end

final_rss = `ps -o rss= -p #{Process.pid}`.strip.to_i
final_live = GC.stat[:heap_live_slots]
puts "\nFinal: RSS=#{final_rss} KB (%+d), live_slots=#{final_live} (%+d)" % [
  final_rss - initial_rss, final_live - initial_live
]
puts "\nIf you saw 'deadlock; recursive locking' errors above, the bug is reproduced."
puts "RSS growth despite stable live_slots indicates heap fragmentation from repeated ThreadError cycles."

Sentry.close
