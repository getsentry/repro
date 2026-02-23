# frozen_string_literal: true

# Reproduction for https://github.com/getsentry/sentry-ruby/issues/2860
#
# Bug: When a Sidekiq job is pushed to Redis without a "retry" field in the
# message payload, Sentry's error handler considers the job as non-retryable
# and immediately reports it.
#
# Sidekiq resolves missing "retry" from the job class options before executing
# (see sidekiq/processor.rb):
#
#   if msg["retry"].nil?
#     msg["retry"] = jobinst.class.get_sidekiq_options["retry"]
#   end
#
# Since Sidekiq defaults to retry: true (25 retries), a missing "retry" in
# the payload should be treated as retryable. The fix is to treat nil as true
# in Sentry's retryable? check.

require "sidekiq"
require "sentry-ruby"
require "sentry-sidekiq"

# Initialize Sentry with report_after_job_retries enabled
Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"] || "https://key@o1.ingest.sentry.io/1"
  config.sidekiq.report_after_job_retries = true

  # Use a custom transport so we can detect when events are sent
  config.transport.transport_class = Sentry::DummyTransport
end

error_handler = Sentry::Sidekiq::ErrorHandler.new

def run_scenario(error_handler, context)
  Sentry.get_current_scope.clear
  error_handler.call(RuntimeError.new("test error"), context)
  events = Sentry.get_current_client.transport.events.dup
  Sentry.get_current_client.transport.events.clear
  [events, events.length]
end

# Scenario 1: Job payload WITH "retry" => true (normal Sidekiq push)
# Expected: Sentry should NOT report on first failure (retryable, retry_count is nil)
puts "=== Scenario 1: Payload has retry: true ==="
events, count = run_scenario(error_handler, {
  job: { "class" => "MyWorker", "args" => [1], "retry" => true, "retry_count" => nil }
})
puts "Events sent: #{count} (expected: 0)"
puts events.empty? ? "PASS" : "FAIL"
puts

# Scenario 2: Job payload WITHOUT "retry" key (raw push from external system)
# Expected: Sentry should NOT report — Sidekiq defaults to retry: true
# Actual (bug): Sentry sees nil retry and reports immediately
puts "=== Scenario 2: Payload missing retry key ==="
events, count = run_scenario(error_handler, {
  job: { "class" => "MyWorker", "args" => [1], "retry_count" => nil }
})
puts "Events sent: #{count} (expected: 0)"
puts events.empty? ? "PASS" : "FAIL - Sentry reported prematurely! (BUG)"
puts

# Scenario 3: Job payload WITH "retry" => false
# Expected: Sentry SHOULD report — job is explicitly non-retryable
puts "=== Scenario 3: Payload has retry: false ==="
events, count = run_scenario(error_handler, {
  job: { "class" => "MyWorker", "args" => [1], "retry" => false, "retry_count" => nil }
})
puts "Events sent: #{count} (expected: 1)"
puts count == 1 ? "PASS" : "FAIL"
puts

puts "---"
puts "Root cause: Sentry's retryable? check doesn't handle nil (missing) retry."
puts "The comment on line 63 of error_handler.rb says the default is true,"
puts "but the code doesn't treat nil as true."
