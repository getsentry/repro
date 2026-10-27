# frozen_string_literal: true

# Reproduction for getsentry/sentry-ruby#3144
#
# sidekiq-scheduler enqueues jobs from its own long-lived thread. That thread's
# Sentry scope builds one PropagationContext (trace_id + sample_rand) and never
# regenerates it, so SentryContextClientMiddleware stamps every scheduled job
# with the same sentry-trace/baggage. On the server, continue_trace reuses the
# propagated sample_rand, so the sampling decision is fixed per process.

require "bundler/setup"
require "sidekiq"
require "sidekiq-scheduler"
require "sentry-ruby"
require "sentry-sidekiq"

REDIS_URL = ENV.fetch("REDIS_URL", "redis://localhost:6399/0")
LOG_PATH = ENV.fetch("RESULTS_LOG", File.expand_path("results.log", __dir__))
BOOT = ENV.fetch("BOOT", "0")

Sidekiq.configure_client { |config| config.redis = { url: REDIS_URL } }
Sidekiq.configure_server do |config|
  config.redis = { url: REDIS_URL }
  config[:scheduler] = {
    schedule: {
      "every_second_job" => { "every" => "1s", "class" => "ScheduledJob" }
    }
  }
end

# Nothing needs to reach Sentry; a DSN just has to be set so tracing is enabled.
class NullTransport < Sentry::Transport
  def send_envelope(_envelope); end
end

Sentry.init do |config|
  dsn = ENV.fetch("SENTRY_DSN", "")
  if dsn.empty?
    config.dsn = "https://key@o0.ingest.sentry.io/0"
    config.transport.transport_class = NullTransport
  else
    config.dsn = dsn
  end
  config.sdk_logger = Logger.new(nil)

  # Config from the issue report.
  config.traces_sampler = lambda do |ctx|
    next ctx[:parent_sampled] unless ctx[:parent_sampled].nil?
    0.5
  end
  config.enabled_patches += [:sidekiq_scheduler]
end

# SENTRY_FIX=1 applies the workaround from the issue (fresh propagation context
# per scheduled enqueue), which is what we expect the SDK to do by default.
if ENV["SENTRY_FIX"] == "1"
  module SentrySchedulerFreshTrace
    def enqueue_job(*args)
      Sentry.with_scope do |scope|
        scope.generate_propagation_context
        super(*args)
      end
    end
  end
  SidekiqScheduler::Scheduler.prepend(SentrySchedulerFreshTrace)
end

class ScheduledJob
  include Sidekiq::Job

  def perform
    transaction = Sentry.get_current_scope.get_transaction
    trace_id = transaction&.trace_id || Sentry.get_current_scope.propagation_context.trace_id
    sample_rand = transaction&.sample_rand if transaction.respond_to?(:sample_rand)
    line = [BOOT, trace_id, sample_rand.inspect, transaction&.sampled.inspect].join("\t")
    File.open(LOG_PATH, "a") { |f| f.puts(line) }
  end
end
