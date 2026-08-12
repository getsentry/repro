#!/usr/bin/env ruby
# frozen_string_literal: true

# Reproduction for getsentry/sentry-ruby#3052.
#
# This models the application setup described in the issue: EventMachine/
# em-synchrony plus a process-wide fiber-aware Mutex replacement, with
# Sentry's default background worker enabled.

STDOUT.sync = true

require "sentry-ruby"
require "eventmachine"
require "em-synchrony"

fiber_mutex = EventMachine::Synchrony::Thread::Mutex

# concurrent-ruby 1.3.x calls #owned? while re-entering its internal lock.
# em-synchrony 1.0.6 does not expose that method, so add the smallest adapter
# needed to make the replacement usable by this version of concurrent-ruby.
fiber_mutex.class_eval do
  def owned?
    @waiters.first == Fiber.current
  end
end

# Applications/dependencies may replace both constants. Keeping this explicit
# makes it easy to remove either line while comparing behavior.
Object.send(:remove_const, :Mutex)
Object.const_set(:Mutex, fiber_mutex)
Thread.send(:remove_const, :Mutex)
Thread.const_set(:Mutex, fiber_mutex)

Thread.report_on_exception = true

sentry_dsn = ENV.fetch("SENTRY_DSN") do
  abort "SENTRY_DSN is required, for example: SENTRY_DSN=https://public@example.com/1 bundle exec ruby repro.rb"
end

background_threads = Integer(ENV.fetch("SENTRY_BACKGROUND_THREADS", "1"))

Sentry.init do |config|
  config.dsn = sentry_dsn
  config.background_worker_threads = background_threads
  config.background_worker_max_queue = 100
  config.auto_session_tracking = false
  config.sdk_logger = Sentry::Logger.new($stdout)
  config.debug = true
end

puts "Ruby: #{RUBY_DESCRIPTION}"
puts "Mutex: #{Mutex}"
puts "Thread::Mutex: #{Thread::Mutex}"
puts "Background workers: #{Sentry.background_worker.number_of_threads}"
puts "Sentry endpoint: #{Sentry.configuration.dsn.envelope_endpoint}"
puts

EM.synchrony do
  if background_threads > 0
    worker_started = Queue.new
    release_worker = Queue.new

    # Queue a barrier before the event. The worker blocks inside this ordinary
    # background job, allowing the EventMachine fiber to acquire the worker's
    # real executor mutex. The event is queued while the barrier is blocked.
    Sentry.background_worker.perform do
      worker_started << true
      release_worker.pop
    end

    executor = Sentry.background_worker.instance_variable_get(:@executor)
    timer = EM::Synchrony.add_periodic_timer(0.01) do
      next if worker_started.empty?

      EM.cancel_timer(timer)
      puts "Calling Sentry.capture_exception from EventMachine fiber..."
      event = Sentry.capture_exception(StandardError.new("reproduction event"))
      puts "capture returned: #{event ? "an event" : "nil"}"
      puts "Forcing the worker/thread and EventMachine/fiber interleaving..."

      # Releasing the barrier makes the worker cross from the Ruby thread back
      # through executor bookkeeping. em-synchrony's fiber-aware mutex then
      # attempts an invalid Fiber#resume, and the queued Sentry event is not
      # processed.
      executor.send(:synchronize) do
        release_worker << true
        EM::Synchrony.sleep(0.2)
      end
      puts "Executor lock released. Affected runs report FiberError above."
      puts "The event should not have reached Sentry."
      EM::Synchrony.add_timer(1) { exit! 0 }
    end
  else
    # With zero background threads, capture uses ImmediateExecutor and does not
    # cross the thread/fiber boundary. This is the documented workaround.
    puts "Calling Sentry.capture_exception from EventMachine fiber..."
    event = Sentry.capture_exception(StandardError.new("reproduction event"))
    puts "capture returned: #{event ? "an event" : "nil"}"
    EM.add_timer(1) do
      puts "Capture completed with the synchronous-worker workaround."
      exit! 0
    end
  end
end
