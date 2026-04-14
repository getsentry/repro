defmodule ReproApp.Blog.Post do
  use Ecto.Schema

  schema "posts" do
    field :title, :string
    field :body, :string
    belongs_to :author, ReproApp.Blog.Author
    timestamps()
  end
end
