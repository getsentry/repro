defmodule ReproApp.Blog.Author do
  use Ecto.Schema

  schema "authors" do
    field :name, :string
    has_many :posts, ReproApp.Blog.Post
    timestamps()
  end
end
