require "sentry-ruby"

# Simulates the re-entrancy deadlock caused by Yabeda HTTP instrumentation.
#
# In production, the call chain is:
#   MetricEventBuffer#add_item → @mutex.synchronize → send_items
#     → HTTPTransport#send_data → Net::HTTP POST
#       → Yabeda HTTP instrumentation fires
#         → Sentry.metrics.count(...)
#           → MetricEventBuffer#add_item → @mutex.synchronize → DEADLOCK
#
# We simulate this by having the transport call Sentry.metrics during send_data.
class ReentrantTransport < Sentry::Transport
  def send_data(data, options = {})
    Sentry.metrics.count("http.request", value: 1)
  end
end

Sentry.init do |config|
  config.dsn = ENV.fetch("SENTRY_DSN", "https://examplePublicKey@o0.ingest.sentry.io/0")
  config.enable_logs = true
  config.enable_metrics = true
  config.enabled_patches = %i[logger]
  config.transport.transport_class = ReentrantTransport
  config.sdk_logger.level = Logger::FATAL
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
