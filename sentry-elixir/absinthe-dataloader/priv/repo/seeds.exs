alias ReproApp.Repo
alias ReproApp.Blog.{Author, Post}

# Seed some authors and posts for testing
authors =
  for name <- ["Alice", "Bob", "Charlie"] do
    Repo.insert!(%Author{name: name})
  end

for author <- authors, i <- 1..3 do
  Repo.insert!(%Post{
    title: "Post #{i} by #{author.name}",
    body: "Body of post #{i} by #{author.name}",
    author_id: author.id
  })
end

IO.puts("Seeded #{length(authors)} authors with 3 posts each")
