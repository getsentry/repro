defmodule ReproApp.Repo.Migrations.CreateBlogTables do
  use Ecto.Migration

  def change do
    create table(:authors) do
      add :name, :string, null: false
      timestamps()
    end

    create table(:posts) do
      add :title, :string, null: false
      add :body, :text
      add :author_id, references(:authors, on_delete: :delete_all), null: false
      timestamps()
    end

    create index(:posts, [:author_id])
  end
end
