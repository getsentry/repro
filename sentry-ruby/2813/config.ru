require 'sentry-ruby'
require 'rack'

# Configure Sentry with Spotlight for local development
Sentry.init do |config|
  # Use Spotlight instead of sending to Sentry - no DSN required!
  config.spotlight = true
  config.traces_sample_rate = 1.0

  config.before_send_transaction = lambda do |event, hint|
    puts "\n=== Transaction: #{event.transaction} ==="
    event
  end
end

# Simple Rack application
class App
  def call(env)
    sleep 0.1 # Simulate work
    [200, {'Content-Type' => 'text/plain'}, ["OK"]]
  end
end

use Sentry::Rack::CaptureExceptions
run App.new
