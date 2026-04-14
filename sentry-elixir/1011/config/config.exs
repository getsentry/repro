import Config

config :sentry,
  environment_name: :dev,
  enable_source_code_context: false,
  client: Sentry.HackneyClient

# Configure OpenTelemetry to use the Sentry span processor
config :opentelemetry,
  span_processor: :batch,
  traces_exporter: :none

config :logger, level: :info
