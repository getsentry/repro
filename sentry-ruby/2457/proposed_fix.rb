# frozen_string_literal: true

# Sketch of a possible fix for the "concurrency yields zero profiles" half of
# getsentry/sentry-ruby#2457. Loaded as a monkeypatch so it can be demonstrated
# against a released gem.
#
# The point: a losing thread must NOT call ::Vernier.start_profile at all, because
# that call is what stops and discards the winner's collector. Today every
# Transaction builds its own Profiler and they all race for Vernier's global
# collector, so nobody ends up with a profile. With a process-wide ownership guard,
# exactly one profiler holds Vernier at a time and actually gets its result.

module Sentry
  module Vernier
    class Profiler
      @ownership_mutex = Mutex.new
      @owner = nil

      class << self
        # Returns true if this profiler now owns the process-wide Vernier collector.
        def acquire_ownership(profiler)
          @ownership_mutex.synchronize do
            next false if @owner

            @owner = profiler
            true
          end
        end

        def release_ownership(profiler)
          @ownership_mutex.synchronize do
            next false unless @owner.equal?(profiler)

            @owner = nil
            true
          end
        end
      end

      def start
        return unless @sampled
        return if @started

        unless self.class.acquire_ownership(self)
          log("Not started since another transaction is profiling")
          return false
        end

        begin
          @started = ::Vernier.start_profile(interval: @profiles_sample_interval)
          log("Started")
          @started
        rescue RuntimeError => e
          # Vernier was started by something outside the SDK (Sidekiq 8's native
          # profiling, rack-mini-profiler, a manual Vernier.profile block, ...).
          self.class.release_ownership(self)
          @started = false
          log("Failed to start: #{e.message}")
          false
        end
      end

      def stop
        return unless @sampled
        return unless @started

        begin
          @result = ::Vernier.stop_profile
          log("Stopped")
        rescue RuntimeError => e
          log("Failed to stop Vernier: #{e.message}")
        ensure
          @started = false
          self.class.release_ownership(self)
        end
      end
    end
  end
end
