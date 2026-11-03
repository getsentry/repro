#!/usr/bin/env ruby
# frozen_string_literal: true

# Reproduction for getsentry/sentry-ruby#3038.
#
# Sentry::SessionFlusher#add_session updates @pending_aggregates without
# holding @mutex:
#
#   @pending_aggregates[key] ||= init_aggregates(key)
#   @pending_aggregates[key][status] += 1
#
# while the flusher thread swaps the hash under @mutex in #pending_envelope:
#
#   @mutex.synchronize { @pending_aggregates = {} }
#
# Only the reader takes the lock, so nothing stops the swap from landing
# between the two lookups. The second lookup then hits the fresh, empty hash
# and returns nil -> NoMethodError: undefined method '[]' for nil.
# In an app this is raised from Hub#end_session in the Rack middleware's ensure.
#
# Two scenarios:
#   1. deterministic: forces the swap to land right after init_aggregates.
#   2. stress: two real threads, one adding sessions and one flushing, with no
#      artificial hooks. Counts crashes and sessions that never reach an envelope.

STDOUT.sync = true

require "sentry-ruby"

STRESS_SECONDS = Float(ENV.fetch("STRESS_SECONDS", "5"))

Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"] # optional; nothing is sent by this repro
  config.release = "repro-3038"
  config.environment = "repro"
  config.auto_session_tracking = false # we drive our own flusher below
  config.background_worker_threads = 0
  config.transport.transport_class = Sentry::DummyTransport
end

puts "Ruby #{RUBY_VERSION}, sentry-ruby #{Sentry::VERSION} (#{Gem.loaded_specs["sentry-ruby"]&.full_gem_path})"

def new_flusher
  Sentry::SessionFlusher.new(Sentry.configuration, Sentry.get_current_client).tap do |f|
    # Don't start the real 60s flush thread; the scenarios drive the swap.
    def f.ensure_thread = true
  end
end

def exited_session
  Sentry::Session.new.tap(&:close) # status: :exited
end

failures = 0

puts
puts "== 1. deterministic: swap lands between the two lookups in add_session"
flusher = new_flusher
swap_thread = nil
flusher.singleton_class.prepend(Module.new do
  define_method(:init_aggregates) do |key|
    super(key).tap do
      # Run the flush swap on another thread (as the real flusher thread does)
      # and give it up to 0.5s to finish before add_session continues. If
      # add_session held @mutex, the swap would block here until it is done.
      swap_thread = Thread.new { send(:pending_envelope) }
      swap_thread.join(0.5)
    end
  end
end)

begin
  flusher.add_session(exited_session)
  envelope = swap_thread.value
  count = envelope.items.sum { |i| i.payload[:aggregates].sum { |a| a[:exited] } }
  if count == 1
    puts "OK: add_session did not raise and the session was flushed"
  else
    failures += 1
    puts "BUG: add_session did not raise, but the flushed envelope has #{count} sessions (expected 1)"
  end
rescue NoMethodError => e
  failures += 1
  puts "BUG: add_session raised #{e.class}: #{e.message}"
  puts "     at #{e.backtrace.find { |l| l.include?("session_flusher") }}"
end

puts
puts "== 2. stress: real add_session thread vs. real flush-swap thread (#{STRESS_SECONDS}s)"
flusher = new_flusher
added = 0
crashes = 0
flushed = 0
crash_sample = nil
stop = false

flusher_thread = Thread.new do
  until stop
    envelope = flusher.send(:pending_envelope)
    envelope.items.each do |item|
      item.payload[:aggregates].each { |agg| flushed += agg[:exited] }
    end
    Thread.pass
  end
end

deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + STRESS_SECONDS
while Process.clock_gettime(Process::CLOCK_MONOTONIC) < deadline
  begin
    flusher.add_session(exited_session)
    added += 1
  rescue NoMethodError => e
    crashes += 1
    crash_sample ||= e
  end
end
stop = true
flusher_thread.join

# Drain whatever is left after the flusher thread stopped.
flusher.send(:pending_envelope).items.each do |item|
  item.payload[:aggregates].each { |agg| flushed += agg[:exited] }
end

lost = added - flushed
puts "sessions added without error: #{added}"
puts "add_session crashes (NoMethodError): #{crashes}"
puts "  e.g. #{crash_sample.message}" if crash_sample
puts "sessions missing from flushed envelopes: #{lost}"
if crashes.positive? || lost != 0
  failures += 1
  puts "BUG: concurrent add_session + flush is not safe"
else
  puts "OK: no crashes and every session was flushed"
end

puts
if failures.zero?
  puts "RESULT: PASS - SessionFlusher is safe against the flush swap"
else
  puts "RESULT: FAIL - bug reproduced (#{failures}/2 scenarios)"
  exit 1
end
