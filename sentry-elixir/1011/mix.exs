defmodule Repro.MixProject do
  use Mix.Project

  def project do
    [
      app: :repro,
      version: "0.1.0",
      elixir: "~> 1.15",
      start_permanent: false,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger]
    ]
  end

  defp deps do
    [
      {:sentry, "~> 12.0"},
      {:opentelemetry, "~> 1.5"},
      {:opentelemetry_api, "~> 1.4"},
      {:opentelemetry_exporter, "~> 1.8"},
      {:jason, "~> 1.4"},
      {:hackney, "~> 1.20"}
    ]
  end
end
