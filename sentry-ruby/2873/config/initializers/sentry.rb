# frozen_string_literal: true

Sentry.init do |config|
  # DSN not needed - we intercept with before_send_transaction
  config.dsn = "https://examplePublicKey@o0.ingest.sentry.io/0"

  # Enable queue time capture (added in PR #2838)
  config.capture_queue_time = true

  # Capture all transactions
  config.traces_sample_rate = 1.0

  # Inspect transactions before they are sent
  config.before_send_transaction = lambda do |event, _hint|
    data = event.contexts.dig(:trace, :data) || {}
    queue_time = data[:"http.server.request.time_in_queue"]

    puts ""
    puts "=" * 60
    if queue_time
      puts "PASS: Queue time captured: #{queue_time}ms"
    else
      # BUG: Rails subclass overrides start_transaction without
      # calling extract_queue_time from the parent Rack class
      puts "BUG: http.server.request.time_in_queue is MISSING"
      puts "     The Rails CaptureExceptions#start_transaction"
      puts "     overrides the Rack parent without queue time logic."
    end
    puts "=" * 60
    puts ""

    nil # don't actually send
  end
end
