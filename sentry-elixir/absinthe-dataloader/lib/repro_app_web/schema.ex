defmodule ReproAppWeb.Schema do
  use Absinthe.Schema

  import Absinthe.Resolution.Helpers, only: [on_load: 2]

  alias ReproApp.Repo
  alias ReproApp.Blog.Author

  # Dataloader setup
  def context(ctx) do
    loader =
      Dataloader.new()
      |> Dataloader.add_source(:blog, Dataloader.Ecto.new(Repo))

    Map.put(ctx, :loader, loader)
  end

  def plugins do
    [Absinthe.Middleware.Dataloader | Absinthe.Plugin.defaults()]
  end

  # Types
  object :author do
    field :id, :id
    field :name, :string

    # Posts resolved via Dataloader — this is the key difference vs the Ecto endpoint
    field :posts, list_of(:post), resolve: fn author, _args, %{context: %{loader: loader}} ->
      loader
      |> Dataloader.load(:blog, :posts, author)
      |> on_load(fn loader ->
        {:ok, Dataloader.get(loader, :blog, :posts, author)}
      end)
    end
  end

  object :post do
    field :id, :id
    field :title, :string
    field :body, :string
  end

  # Queries
  query do
    @desc "List all authors with their posts (uses Dataloader for posts)"
    field :authors, list_of(:author) do
      resolve fn _args, _resolution ->
        {:ok, Repo.all(Author)}
      end
    end

    @desc "Get a single author by ID (uses Dataloader for posts)"
    field :author, :author do
      arg :id, non_null(:id)

      resolve fn %{id: id}, _resolution ->
        case Repo.get(Author, id) do
          nil -> {:error, "Author not found"}
          author -> {:ok, author}
        end
      end
    end
  end
end
