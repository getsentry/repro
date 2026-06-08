require "sentry-ruby"
require "objspace"

# Demonstrates memory growth from the re-entrancy deadlock.
#
# In production, the leak compounds because:
# 1. Every flush cycle raises ThreadError, creating exception objects + backtraces
# 2. Error logging allocates strings on every failed flush
# 3. The transport may retain failed envelopes internally
# 4. Under sustained load (1000s of requests/sec), these allocations outpace GC

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

puts "Simulating sustained metric emission with deadlocking flushes..."
puts "Initial RSS: #{initial_rss} KB, live slots: #{initial_live}"
puts

20.times do |round|
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
puts "\nFinal: RSS=#{final_rss} KB (#{final_rss > initial_rss ? '+' : ''}#{final_rss - initial_rss}), " \
     "live_slots=#{final_live} (#{final_live > initial_live ? '+' : ''}#{final_live - initial_live})"
Sentry.close
