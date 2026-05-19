defmodule ReproApp.Repo do
  use Ecto.Repo,
    otp_app: :repro_app,
    adapter: Ecto.Adapters.Postgres
end
