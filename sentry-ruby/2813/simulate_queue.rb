#!/usr/bin/env ruby

require 'net/http'
require 'uri'

# Simulate a request that was queued 500ms ago
queue_time_ms = 500
queue_start_time = Time.now.to_f - (queue_time_ms / 1000.0)
timestamp_micros = (queue_start_time * 1_000_000).to_i

uri = URI('http://localhost:9292/')
request = Net::HTTP::Get.new(uri)
request['X-Request-Start'] = "t=#{timestamp_micros}"

puts "Sending request with ~#{queue_time_ms}ms simulated queue time..."
response = Net::HTTP.new(uri.host, uri.port).request(request)
puts "Response: #{response.code}"
