# frozen_string_literal: true

Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"]
  config.breadcrumbs_logger = [:sentry_logger]
  config.environment = "development"

  # Enable debug mode to see what's being sent
  config.debug = true

  # Log the metrics aggregator output
  config.before_send = lambda do |event, hint|
    puts "[Sentry] Sending event: #{event.event_id}"
    event
  end
end
