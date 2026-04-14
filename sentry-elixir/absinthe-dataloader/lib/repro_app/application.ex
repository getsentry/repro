defmodule ReproApp.Application do
  use Application

  @impl true
  def start(_type, _args) do
    # Set up OpenTelemetry instrumentation
    :opentelemetry_cowboy.setup()
    OpentelemetryPhoenix.setup(adapter: :cowboy2)
    OpentelemetryEcto.setup([:repro_app, :repo], db_statement: :enabled)
    OpentelemetryAbsinthe.setup()
    OpentelemetryDataloader.setup()

    children = [
      ReproApp.Repo,
      ReproAppWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: ReproApp.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
