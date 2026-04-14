defmodule ReproAppWeb.Router do
  use Phoenix.Router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/" do
    pipe_through :api

    # Normal Ecto endpoint — fetches authors with preloaded posts via Ecto
    get "/ecto/authors", ReproAppWeb.AuthorController, :index

    # GraphQL endpoint — uses Absinthe with Dataloader for resolving posts
    forward "/graphql", Absinthe.Plug, schema: ReproAppWeb.Schema

    # GraphiQL UI for manual testing
    forward "/graphiql", Absinthe.Plug.GraphiQL,
      schema: ReproAppWeb.Schema,
      interface: :playground
  end
end
