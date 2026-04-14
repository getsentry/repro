import Config

if config_env() == :prod do
  config :repro_app, ReproApp.Repo,
    url: System.get_env("DATABASE_URL"),
    pool_size: String.to_integer(System.get_env("POOL_SIZE", "10"))
end
