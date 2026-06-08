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
    # Simulates what happens when Yabeda instruments the outgoing HTTP request
    # and records a metric via Sentry.metrics — this re-enters MetricEventBuffer
    # while the same thread already holds its mutex.
    Sentry.metrics.count("http.request", value: 1)
  end
end

Sentry.init do |config|
  config.dsn = ENV.fetch("SENTRY_DSN", "https://examplePublicKey@o0.ingest.sentry.io/0")
  config.enable_logs = true
  config.enable_metrics = true
  config.enabled_patches = %i[logger]
  config.transport.transport_class = ReentrantTransport
  config.sdk_logger.level = Logger::ERROR
end

puts "Triggering re-entrant metric emission to cause deadlock..."
puts "The MetricEventBuffer flush will call transport.send_data,"
puts "which calls Sentry.metrics.count(), re-entering the same mutex."
puts

# Fill the buffer enough to trigger a flush during add_item
20.times do |i|
  Sentry.metrics.count("repro.counter", value: 1)
  puts "Sent metric #{i + 1}/20"
end

# Also wait for the periodic flush to fire
puts "\nWaiting for background flush (6s)..."
sleep 6

puts "\nDone. If you saw 'deadlock; recursive locking' above, the bug is reproduced."
Sentry.close
