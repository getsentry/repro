# frozen_string_literal: true

Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"]
  config.breadcrumbs_logger = [:sentry_logger]

  # Enable debug mode to see what's being sent
  config.sdk_logger.level = ::Logger::DEBUG
  config.send_default_pii = true

  # Log the metrics aggregator output
  config.before_send_metric = lambda do |event|
    puts "[Sentry] Sending event: #{event.to_h}"
    event
  end
end
