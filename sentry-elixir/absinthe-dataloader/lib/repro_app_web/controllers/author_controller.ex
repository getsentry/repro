defmodule ReproAppWeb.AuthorController do
  use Phoenix.Controller, formats: [:json]

  alias ReproApp.Repo
  alias ReproApp.Blog.Author

  import Ecto.Query

  def index(conn, _params) do
    authors =
      Author
      |> preload(:posts)
      |> Repo.all()

    json(conn, %{
      data:
        Enum.map(authors, fn author ->
          %{
            id: author.id,
            name: author.name,
            posts:
              Enum.map(author.posts, fn post ->
                %{id: post.id, title: post.title, body: post.body}
              end)
          }
        end)
    })
  end
end
