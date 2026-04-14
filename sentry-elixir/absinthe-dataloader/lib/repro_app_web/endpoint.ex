defmodule ReproAppWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :repro_app
  use Sentry.PlugCapture

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Jason

  plug Sentry.PlugContext
  plug ReproAppWeb.Router
end
