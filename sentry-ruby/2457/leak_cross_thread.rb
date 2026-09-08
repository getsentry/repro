# Abandoned transaction on thread 1; then well-behaved transactions on thread 2.
# Unpatched, thread 2's start_profile kills the stale collector (self-heals after one victim).
require "bundler/setup"
require "sentry-ruby"
require "vernier"

class CountingTransport < Sentry::Transport
  COUNTS = Hash.new(0)
  MUTEX = Mutex.new
  def send_envelope(env)
    MUTEX.synchronize { env.items.each { |i| COUNTS[i.headers[:type].to_s] += 1 } }
  end
end

Sentry.init do |c|
  c.dsn = "http://public@localhost:9999/1"
  c.profiler_class = Sentry::Vernier::Profiler
  c.traces_sample_rate = 1.0
  c.profiles_sample_rate = 1.0
  c.background_worker_threads = 0
  c.transport.transport_class = CountingTransport
end

def burn(s)
  d = Process.clock_gettime(Process::CLOCK_MONOTONIC) + s
  x = 0
  x += 1 while Process.clock_gettime(Process::CLOCK_MONOTONIC) < d
end

Thread.new { Sentry.clone_hub_to_current_thread; Sentry.start_transaction(name: "abandoned", op: "q"); burn(0.1) }.join

Thread.new do
  Sentry.clone_hub_to_current_thread
  3.times do |i|
    t = Sentry.start_transaction(name: "later-#{i}", op: "q")
    burn(0.2)
    t.finish
  end
end.join

c = CountingTransport::COUNTS
puts "profile=#{c["profile"]} of 3 well-behaved transactions on a clean thread"
