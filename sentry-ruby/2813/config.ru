require 'sentry-ruby'
require 'rack'

# Configure Sentry
Sentry.init do |config|
  config.dsn = ENV['SENTRY_DSN']
  config.traces_sample_rate = 1.0
  config.enable_tracing = true

  # Log transactions to console for inspection
  config.before_send_transaction = lambda do |event, hint|
    puts "\n=== Sentry Transaction ===="
    puts "Transaction: #{event.transaction}"
    puts "Start timestamp: #{event.start_timestamp}"
    puts "Timestamp: #{event.timestamp}"
    puts "Duration: #{event.timestamp - event.start_timestamp} seconds"
    puts "\nContext data:"
    puts event.contexts.inspect
    puts "\nExtra data:"
    puts event.extra.inspect
    puts "\nTags:"
    puts event.tags.inspect
    puts "========================\n"
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
