# frozen_string_literal: true

# Minimal, Redis-free reproduction of getsentry/sentry-ruby#2457.
#
# Sidekiq runs jobs on several threads inside one process. Vernier's profiler is a
# *global* singleton (`Vernier.@collector`), so two concurrent transactions fight
# over it. From vernier/lib/vernier.rb:
#
#   def self.start_profile(...)
#     if @collector
#       @collector.stop            # <- stops whoever was profiling
#       @collector = nil
#       raise "profile already started, stopping..."
#     end
#     ...
#   end
#
#   def self.stop_profile
#     raise "profile not started" unless @collector
#     ...
#   end
#
# So:
#   Thread A: Vernier.start_profile -> @collector = A     (Sentry marks @started = true)
#   Thread B: Vernier.start_profile -> stops A, @collector = nil, raises "already started"
#   Thread A: Vernier.stop_profile  -> @collector is nil  -> raises "profile not started"
#
# On sentry-ruby 5.21.0 `Sentry::Vernier::Profiler#stop` has no rescue, so that
# RuntimeError escapes `transaction.finish` - and, in a real app, out of
# sentry-sidekiq's server middleware. That is the error in the issue report.
#
# This script performs the same sequence as SentryContextServerMiddleware,
# without needing Sidekiq or Redis.

$stdout.sync = true

require "bundler/setup"
require "sentry-ruby"
require "vernier"

# A DSN must be present for tracing (and therefore profiling) to be enabled at all.
# Nothing is actually sent anywhere - this transport just counts envelope items.
class CountingTransport < Sentry::Transport
  COUNTS = Hash.new(0)
  MUTEX = Mutex.new

  def send_envelope(envelope)
    MUTEX.synchronize do
      envelope.items.each { |item| COUNTS[item.headers[:type].to_s] += 1 }
    end
  end
end

Sentry.init do |config|
  config.dsn = ENV.fetch("SENTRY_DSN", "http://public@localhost:9999/1")
  config.profiler_class = Sentry::Vernier::Profiler
  config.traces_sample_rate = 1.0
  config.profiles_sample_rate = 1.0
  config.background_worker_threads = 0
  config.transport.transport_class = CountingTransport unless ENV["SENTRY_DSN"]
  if ENV["SENTRY_LOG"]
    config.debug = true
    # `debug = true` alone is not enough on 7.x - the SDK logger level must be lowered too.
    config.sdk_logger.level = ::Logger::DEBUG if config.respond_to?(:sdk_logger)
  end
end

puts "sentry-ruby #{Sentry::VERSION} | vernier #{Vernier::VERSION} | ruby #{RUBY_VERSION}"

THREADS = Integer(ENV.fetch("THREADS", "4"))
errors = Queue.new

def burn(seconds)
  deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + seconds
  x = 0
  x += 1 while Process.clock_gettime(Process::CLOCK_MONOTONIC) < deadline
  x
end

THREADS.times.map { |i|
  Thread.new do
    # Same sequence as sentry-sidekiq's server middleware.
    Sentry.clone_hub_to_current_thread
    transaction = Sentry.start_transaction(name: "job-#{i}", op: "queue.sidekiq")

    begin
      burn(0.3)
      transaction.set_http_status(200)
      transaction.finish # <- Profiler#stop happens in here
      puts "thread #{i}: ok"
    rescue => e
      errors << e
      puts "thread #{i}: #{e.class}: #{e.message}"
    end
  end
}.each(&:join)

puts

if errors.empty?
  counts = CountingTransport::COUNTS
  puts "NO EXCEPTION RAISED - profiler contention is handled gracefully."
  unless counts.empty?
    puts "Envelope items sent: #{counts.sort.map { |k, v| "#{k}=#{v}" }.join(", ")}"
    puts "#{counts["profile"]}/#{THREADS} transactions carry a profile."
    if counts["profile"].zero? && THREADS > 1
      # The loser's start_profile stops the *winner's* collector before raising, so
      # the winner's stop_profile then fails too and its result is discarded. With any
      # concurrency at all, nobody gets a profile - not "one profile at a time".
      puts "-> Nobody won the race: the loser's start_profile stopped the winner's collector,"
      puts "   so the winner's stop_profile failed too. Try THREADS=1 to see a profile emitted."
    end
  end
  puts "Run with SENTRY_LOG=1 to see the profiler's debug log."
  exit 0
else
  tally = Hash.new(0)
  tally["#{(e = errors.pop).class}: #{e.message}"] += 1 until errors.empty?
  puts "REPRODUCED: #{tally.values.sum}/#{THREADS} transactions raised while finishing:"
  tally.each { |msg, n| puts "  #{n}x #{msg}" }
  exit 1
end
