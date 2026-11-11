#!/usr/bin/env ruby
# frozen_string_literal: true

# Reproduction for getsentry/sentry-ruby#3037.
#
# Sentry::Transport keeps @discarded_events in a plain Hash with no lock.
# #fetch_pending_client_report iterates it:
#
#   discarded_events_hash = @discarded_events.map do |key, val| ... end
#
# while #record_lost_event inserts into it from any thread:
#
#   @discarded_events[[reason, data_category]] += num
#
# Ruby forbids adding a key to a Hash that is being iterated, and raises in the
# INSERTING thread: RuntimeError: can't add a new key into hash during iteration.
# So the error surfaces in record_lost_event (called from Client#capture_event,
# the background worker, rate limiting, ...), not in the client report code.
#
# Two scenarios:
#   1. deterministic: pause the real Hash iteration inside
#      fetch_pending_client_report after its first entry and call the real
#      record_lost_event from another thread at that moment.
#   2. stress: no hooks. One thread calls record_lost_event in a loop while the
#      main thread builds client reports. As in the issue, the hash is widened
#      to 20k keys so the iteration window is long enough to hit.
#
# Expected: record_lost_event never raises.
# Exit code: 1 when the bug reproduces, 0 when both scenarios pass.

STDOUT.sync = true

require "sentry-ruby"

STRESS_ROUNDS = Integer(ENV.fetch("STRESS_ROUNDS", "200"))

Sentry.init do |config|
  config.dsn = "https://public@example.com/1" # dummy; nothing is sent
  config.background_worker_threads = 0
  config.transport.transport_class = Sentry::DummyTransport
end

puts "Ruby #{RUBY_VERSION}, sentry-ruby #{Sentry::VERSION} (#{Gem.loaded_specs["sentry-ruby"]&.full_gem_path})"

transport = Sentry.get_current_client.transport
failures = 0

puts
puts "== 1. deterministic: record_lost_event while a client report is iterating"
transport.record_lost_event(:network_error, "error")
discarded = transport.instance_variable_get(:@discarded_events)
writer_error = nil
writer_thread = nil
# Hash#map goes through #each. Wrap the real #each so that, after it yields the
# first entry, the real record_lost_event runs on another thread while the
# iteration is still in progress. A thread-safe transport may make the writer
# wait for the report to finish; that is fine, so only wait briefly here.
discarded.define_singleton_method(:each) do |&blk|
  first = true
  super() do |*args|
    blk.call(*args)
    next unless first

    first = false
    writer_thread = Thread.new do
      transport.record_lost_event(:network_error, "transaction")
    rescue => e
      writer_error = e
    end
    writer_thread.join(0.5)
  end
end
transport.send(:fetch_pending_client_report, force: true)
writer_thread.join
pending = transport.instance_variable_get(:@discarded_events)
if writer_error
  failures += 1
  puts "BUG: record_lost_event raised #{writer_error.class}: #{writer_error.message}"
  puts "     at #{writer_error.backtrace.find { |l| l.include?("transport.rb") } || writer_error.backtrace.first}"
elsif pending[[:network_error, "transaction"]] != 1
  failures += 1
  puts "BUG: the lost event was not recorded for the next client report (#{pending.inspect})"
else
  puts "ok: record_lost_event did not raise, and the event is pending for the next report"
end

puts
puts "== 2. stress: real record_lost_event thread vs. real client report builds (#{STRESS_ROUNDS} rounds)"
errors = Queue.new
done = false
calls = 0
writer = Thread.new do
  until done
    begin
      transport.record_lost_event(:network_error, "category#{calls += 1}")
    rescue => e
      errors << e
    end
  end
end
STRESS_ROUNDS.times do
  wide = Hash.new(0)
  20_000.times { |i| wide[[:network_error, "seed#{i}"]] = 1 }
  transport.instance_variable_set(:@discarded_events, wide)
  transport.send(:fetch_pending_client_report, force: true)
end
done = true
writer.join
puts "record_lost_event calls: #{calls}"
puts "record_lost_event errors: #{errors.size}"
if errors.empty?
  puts "ok: no errors"
else
  failures += 1
  e = errors.pop
  puts "BUG: e.g. #{e.class}: #{e.message}"
end

puts
if failures.zero?
  puts "RESULT: PASS - bug not reproduced"
  exit 0
else
  puts "RESULT: FAIL - bug reproduced (#{failures}/2 scenarios)"
  exit 1
end
