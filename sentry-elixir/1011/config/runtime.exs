import Config

if dsn = System.get_env("SENTRY_DSN") do
  config :sentry, dsn: dsn
end
