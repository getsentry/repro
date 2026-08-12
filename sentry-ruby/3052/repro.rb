#!/usr/bin/env ruby
# frozen_string_literal: true

# Reproduction for getsentry/sentry-ruby#3052.
#
# This is a small, standalone reproduction of the application setup described
# in the issue: EventMachine/em-synchrony plus a process-wide fiber-aware Mutex
# replacement, with Sentry's default background worker enabled.

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

class ControlledHTTPTransport < Sentry::HTTPTransport
  attr_reader :sent

  def initialize(configuration)
    super
    @sent = 0
    @worker_started = Queue.new
    @release_worker = Queue.new
    @request_finished = Queue.new
    @reactor_thread = Thread.current
  end

  def send_data(data, *args)
    @sent += 1

    if Thread.current != @reactor_thread
      # Hold the real HTTP request until the EventMachine fiber owns the
      # executor mutex. The request is still sent to the supplied SENTRY_DSN.
      @worker_started << true
      @release_worker.pop
    end

    super
  ensure
    @request_finished << true if Thread.current != @reactor_thread
  end

  def worker_started?
    !@worker_started.empty?
  end

  def request_finished?
    !@request_finished.empty?
  end

  def release_worker
    @release_worker << true
  end
end

sentry_dsn = ENV.fetch("SENTRY_DSN") do
  abort "SENTRY_DSN is required, for example: SENTRY_DSN=https://public@example.com/1 bundle exec ruby repro.rb"
end

background_threads = Integer(ENV.fetch("SENTRY_BACKGROUND_THREADS", "1"))

Sentry.init do |config|
  config.dsn = sentry_dsn
  config.background_worker_threads = background_threads
  config.background_worker_max_queue = 100
  config.transport.transport_class = ControlledHTTPTransport
  config.auto_session_tracking = false
  config.sdk_logger = Sentry::Logger.new($stdout)
  config.debug = true
end

transport = Sentry.get_current_client.transport
puts "Ruby: #{RUBY_DESCRIPTION}"
puts "Mutex: #{Mutex}"
puts "Thread::Mutex: #{Thread::Mutex}"
puts "Background workers: #{Sentry.background_worker.number_of_threads}"
puts "Sentry endpoint: #{Sentry.configuration.dsn.envelope_endpoint}"
puts

EM.synchrony do
  puts "Calling Sentry.capture_exception from EventMachine fiber..."
  event = Sentry.capture_exception(StandardError.new("reproduction event"))
  puts "capture returned: #{event ? "an event" : "nil"}"

  if background_threads > 0
    # Force the problematic interleaving: the worker has entered transport
    # send_data, then this EventMachine fiber holds the same executor mutex
    # while the worker crosses back from the Ruby thread.
    executor = Sentry.background_worker.instance_variable_get(:@executor)
    timer = EM::Synchrony.add_periodic_timer(0.01) do
      next unless transport.worker_started?

      EM.cancel_timer(timer)
      puts "Forcing the worker/thread and EventMachine/fiber interleaving..."
      executor.send(:synchronize) do
        transport.release_worker
        EM::Synchrony.sleep(0.1)
      end
      puts "Executor lock released. Affected runs report FiberError above."
      EM::Synchrony.add_timer(2) do
        puts "HTTP request completed: #{transport.request_finished?}"
        puts "HTTP sends attempted: #{transport.sent}"
        exit! 0
      end
    end
  else
    # With zero background threads, send_data runs in this fiber and the
    # ImmediateExecutor workaround does not cross the thread/fiber boundary.
    EM.add_timer(2) do
      puts
      puts "HTTP request completed: #{transport.request_finished?}"
      puts "HTTP sends attempted: #{transport.sent}"
      puts "Expected with the workaround: 1"
      exit! 0
    end
  end
end
