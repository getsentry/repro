# frozen_string_literal: true

# Sidekiq flavour of getsentry/sentry-ruby#2457 - the setup from the issue report:
# sentry-ruby + sentry-sidekiq + Vernier profiling, several worker threads in one process.

require "bundler/setup"
require "sidekiq"
require "sentry-ruby"
require "sentry-sidekiq"
require "vernier"

REDIS_URL = ENV.fetch("REDIS_URL", "redis://localhost:6399/0")

Sidekiq.configure_client { |config| config.redis = { url: REDIS_URL } }
Sidekiq.configure_server { |config| config.redis = { url: REDIS_URL } }

# Nothing needs to reach Sentry for the repro; a DSN just has to be present so
# that tracing (and therefore profiling) is enabled.
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
  config.transport.transport_class = CountingTransport unless ENV["SENTRY_DSN"]
end

at_exit do
  counts = CountingTransport::COUNTS
  warn "### envelope items: #{counts.sort.map { |k, v| "#{k}=#{v}" }.join(", ")}" unless counts.empty?
end

Sidekiq.configure_server do |config|
  config.error_handlers << lambda do |ex, _ctx, _cfg|
    warn "!!! REPRODUCED - job raised #{ex.class}: #{ex.message}"
  end
end

class BurnCpuJob
  include Sidekiq::Job
  sidekiq_options retry: false

  def perform(seconds = 0.3)
    deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + seconds
    x = 0
    x += 1 while Process.clock_gettime(Process::CLOCK_MONOTONIC) < deadline
    x
  end
end
