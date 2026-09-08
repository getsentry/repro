# Does an abandoned transaction (started, never finished) disable profiling forever?
require "bundler/setup"
require "sentry-ruby"
require "vernier"

class CountingTransport < Sentry::Transport
  COUNTS = Hash.new(0)
  def send_envelope(env) = env.items.each { |i| COUNTS[i.headers[:type].to_s] += 1 }
end

Sentry.init do |c|
  c.dsn = "http://public@localhost:9999/1"
  c.profiler_class = Sentry::Vernier::Profiler
  c.traces_sample_rate = 1.0
  c.profiles_sample_rate = 1.0
  c.background_worker_threads = 0
  c.debug = true
  c.sdk_logger.level = ::Logger::DEBUG
  c.transport.transport_class = CountingTransport
end

def burn(s) = (d = Process.clock_gettime(Process::CLOCK_MONOTONIC) + s; x = 0; x += 1 while Process.clock_gettime(Process::CLOCK_MONOTONIC) < d)

# Abandoned transaction: started, profiler running, never finished.
Sentry.start_transaction(name: "abandoned", op: "queue.sidekiq")
burn(0.1)

# Now three well-behaved sequential transactions.
3.times do |i|
  t = Sentry.start_transaction(name: "later-#{i}", op: "queue.sidekiq")
  burn(0.2)
  t.finish
end

c = CountingTransport::COUNTS
puts "sentry-ruby #{Sentry::VERSION}: profile=#{c["profile"]} transaction=#{c["transaction"]} (of 3 well-behaved)"
