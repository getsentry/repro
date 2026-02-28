#!/usr/bin/env ruby
# frozen_string_literal: true

# Self-contained test that boots Rails inline and makes a request
# with X-Request-Start header to check if queue time is captured.

ENV["RAILS_ENV"] = "production"
ENV["RAILS_LOG_TO_STDOUT"] = "1"

require_relative "config/environment"

require "net/http"

app = Rails.application

# Simulate a request with X-Request-Start header (as nginx/HAProxy would set)
# Set to 100ms ago to simulate 100ms of queue time
request_start_time = Time.now.to_f - 0.1

env = Rack::MockRequest.env_for(
  "/test",
  "HTTP_X_REQUEST_START" => "t=#{request_start_time}"
)

puts "Making request with X-Request-Start header..."
puts "  X-Request-Start: t=#{request_start_time}"
puts "  Expected queue time: ~100ms"
puts ""

status, headers, body = app.call(env)
body.close if body.respond_to?(:close)

puts ""
puts "Response status: #{status}"
puts ""
puts "If you see 'BUG: http.server.request.time_in_queue is MISSING'"
puts "then the bug is confirmed — Rails overrides start_transaction"
puts "without calling the queue time capture from the Rack parent class."
