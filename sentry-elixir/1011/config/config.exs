import Config

config :sentry,
  dsn: System.get_env("SENTRY_DSN") || "",
  environment_name: :dev,
  enable_source_code_context: false

# Configure OpenTelemetry to use the Sentry span processor
config :opentelemetry,
  span_processor: :batch,
  traces_exporter: :none

config :logger, level: :info
