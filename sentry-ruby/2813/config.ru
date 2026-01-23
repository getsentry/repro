require 'sentry-ruby'
require 'rack'

# Configure Sentry with Spotlight for local development
Sentry.init do |config|
  # Use Spotlight instead of sending to Sentry - no DSN required!
  config.spotlight = true
  config.traces_sample_rate = 1.0
  config.enable_tracing = true

  # Optional: Still log to console for quick verification
  config.before_send_transaction = lambda do |event, hint|
    puts "\n=== Transaction captured by Sentry ==="
    puts "Transaction: #{event.transaction}"
    puts "Duration: #{event.timestamp - event.start_timestamp} seconds"
    puts "Check Spotlight UI for full transaction details"
    puts "====================================\n"
    event
  end
end

# Simple Rack application
class App
  def call(env)
    # This is where Sentry begins tracking the transaction
    # At this point, the request may have already waited in Puma's queue

    # Print queue time if available from headers
    request_start = env['HTTP_X_REQUEST_START']
    queue_start = env['HTTP_X_QUEUE_START']
    puma_wait = env['puma.request_body_wait']

    puts "\n=== Request Headers ==="
    puts "X-Request-Start: #{request_start}"
    puts "X-Queue-Start: #{queue_start}"
    puts "puma.request_body_wait: #{puma_wait}"

    # Calculate queue time manually for demonstration
    if request_start
      # Parse the timestamp (format: t=1234567890.123456)
      time_string = request_start.gsub(/t=|\./, '')
      started_at = "#{time_string[0,10]}.#{time_string[10,13]}".to_f
      queue_time_ms = ((Time.now.to_f - started_at) * 1000).to_i
      puts "Calculated queue time: #{queue_time_ms}ms"
    end
    puts "=====================\n"

    # Simulate some work
    sleep 0.1

    [200, {'Content-Type' => 'text/plain'}, ["Hello! Check console for Sentry transaction details."]]
  end
end

use Sentry::Rack::CaptureExceptions
run App.new
