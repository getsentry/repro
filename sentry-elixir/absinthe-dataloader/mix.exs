defmodule ReproApp.MixProject do
  use Mix.Project

  def project do
    [
      app: :repro_app,
      version: "0.1.0",
      elixir: "~> 1.17",
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps()
    ]
  end

  def application do
    [
      mod: {ReproApp.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  defp deps do
    [
      # Phoenix & web
      {:phoenix, "~> 1.8"},
      {:phoenix_ecto, "~> 4.6"},
      {:plug_cowboy, "~> 2.7"},
      {:jason, "~> 1.4"},

      # Database
      {:ecto_sql, "~> 3.13"},
      {:postgrex, "~> 0.21"},

      # GraphQL
      {:absinthe, "~> 1.7"},
      {:absinthe_plug, "~> 1.5"},
      {:absinthe_phoenix, "~> 2.0"},
      {:dataloader, "~> 2.0"},

      # Sentry
      {:sentry, "~> 12.0"},
      {:finch, "~> 0.19"},

      # OpenTelemetry
      {:opentelemetry, "~> 1.7"},
      {:opentelemetry_api, "~> 1.5"},
      {:opentelemetry_exporter, "~> 1.10"},
      {:opentelemetry_cowboy, "~> 1.0"},
      {:opentelemetry_ecto, "~> 1.2"},
      {:opentelemetry_phoenix, "~> 2.0"},
      {:opentelemetry_absinthe, "~> 2.4"},
      {:opentelemetry_sentry, "~> 0.1"},
      {:opentelemetry_telemetry, "~> 1.0"},
      {:opentelemetry_semantic_conventions, "~> 1.27"}
    ]
  end

  defp aliases do
    [
      setup: ["deps.get", "ecto.setup"],
      "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
      "ecto.reset": ["ecto.drop", "ecto.setup"]
    ]
  end
end
