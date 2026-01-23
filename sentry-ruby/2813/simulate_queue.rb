#!/usr/bin/env ruby

# This script simulates requests with queue time by sending
# X-Request-Start header to demonstrate what should be captured

require 'net/http'
require 'uri'

puts "Simulating requests with queue time..."
puts "Make sure Puma is running: bundle exec puma -C puma_config.rb\n\n"

# Simulate a request that was queued 500ms ago
queue_time_ms = 500
queue_start_time = Time.now.to_f - (queue_time_ms / 1000.0)

# Format as Puma would (microsecond precision)
timestamp_micros = (queue_start_time * 1_000_000).to_i
header_value = "t=#{timestamp_micros}"

uri = URI('http://localhost:9292/')
http = Net::HTTP.new(uri.host, uri.port)

request = Net::HTTP::Get.new(uri)
request['X-Request-Start'] = header_value

puts "Sending request with X-Request-Start: #{header_value}"
puts "This represents ~#{queue_time_ms}ms of queue time\n\n"

response = http.request(request)
puts "Response status: #{response.code}"
puts "\n✓ Check the Puma console output to see the calculated queue time"
puts "✓ Check Spotlight UI (http://localhost:8969) to inspect the Sentry transaction\n\n"
puts "Expected: Transaction should include queue_time attribute in Spotlight"
puts "Actual: Queue time is NOT captured - only processing time is shown"
