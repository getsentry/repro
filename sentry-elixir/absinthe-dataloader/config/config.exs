import Config

config :repro_app,
  ecto_repos: [ReproApp.Repo]

config :repro_app, ReproApp.Repo,
  username: System.get_env("DB_USER", "postgres"),
  password: System.get_env("DB_PASSWORD", "postgres"),
  hostname: System.get_env("DB_HOST", "localhost"),
  database: "repro_app_dev",
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10

config :repro_app, ReproAppWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Phoenix.Endpoint.Cowboy2Adapter,
  http: [port: 4000],
  render_errors: [formats: [json: ReproAppWeb.ErrorJSON], layout: false],
  server: true

config :phoenix, :json_library, Jason

# Sentry config
config :sentry,
  dsn: System.get_env("SENTRY_DSN"),
  traces_sample_rate: 1.0,
  environment_name: System.get_env("SENTRY_ENVIRONMENT", "development"),
  enable_source_code_context: true,
  root_source_code_paths: [File.cwd!()]

# OpenTelemetry config — use Sentry span processor + sampler
config :opentelemetry,
  span_processor: {Sentry.OpenTelemetry.SpanProcessor, []},
  sampler: {Sentry.OpenTelemetry.Sampler, []},
  text_map_propagators: [OpentelemetrySentry.Propagator]

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]
