require "faraday"
require "sentry-ruby"

Sentry.init do |config|
  config.dsn = nil
  config.enabled_patches = [:faraday]
end

stubs = Faraday::Adapter::Test::Stubs.new do |stub|
  stub.get("/") { [200, {}, "ok"] }
end

builder = Faraday::RackBuilder.new do |connection|
  connection.adapter :test, stubs
end

puts "Constructing primary connection"
primary = Faraday.new("https://primary.example", builder: builder)
puts "Making primary request (this locks the builder)"
primary.get("/")
puts "Primary request succeeded"

puts "Constructing fallback connection with the same builder"
# Expected: this succeeds because Sentry's Faraday middleware has already
# been inserted into this builder. Actual: Sentry calls builder.insert again
# and Faraday raises Faraday::RackBuilder::StackLocked.
Faraday.new("https://fallback.example", builder: builder)
puts "Fallback connection succeeded"
