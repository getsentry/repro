# frozen_string_literal: true

# The most minimal fix for getsentry/sentry-ruby#2457.
#
# The entire bug is Vernier's module-level API: `start_profile`/`stop_profile` share
# one process-global `@collector`, and starting a second profile *stops and discards*
# the running one. `Vernier::Collector` itself is happy to run concurrently.
#
# So give each thread its own collector. Sentry's Profiler is untouched - its logging
# and its `rescue RuntimeError` still work exactly as before.

require "vernier"

module Vernier
  def self.start_profile(mode: :wall, **collector_options)
    Thread.current[:sentry_vernier_collector] = Collector.new(mode, collector_options).tap(&:start)
  end

  def self.stop_profile
    # `&.` so a transaction finished on another thread degrades to "no profile"
    # rather than a NoMethodError, which Sentry's `rescue RuntimeError` would not catch.
    Thread.current[:sentry_vernier_collector]&.stop
  end
end
