# Reproduction: sentry-elixir Absinthe + Dataloader

**SDK:** sentry-elixir ~> 12.0

## Description

A minimal Phoenix application with two endpoints to compare Sentry trace instrumentation between normal Ecto queries and Absinthe/Dataloader-resolved queries:

- **`GET /ecto/authors`** — REST endpoint using `Repo.all` with `preload(:posts)` (standard Ecto)
- **`POST /graphql`** — Absinthe GraphQL endpoint where posts are resolved via Dataloader

Both endpoints return the same data (authors with their posts), but use different data-fetching strategies. This lets you compare how each appears in Sentry traces with OpenTelemetry instrumentation.

## Prerequisites

- Elixir >= 1.17
- Docker (for PostgreSQL) or PostgreSQL running locally
- A Sentry DSN (optional — works without one for local Spotlight inspection)

## Steps to Reproduce

1. Start PostgreSQL:
   ```bash
   cd sentry-elixir/absinthe-dataloader
   docker compose up -d
   ```

2. Install dependencies:
   ```bash
   mix deps.get
   ```

3. Set up the database:
   ```bash
   mix ecto.setup
   ```

4. Set your Sentry DSN (optional):
   ```bash
   export SENTRY_DSN="your-dsn-here"
   ```

5. (Optional) Start Spotlight for local event inspection:
   ```bash
   npx @spotlightjs/spotlight
   ```

6. Start the server:
   ```bash
   mix phx.server
   ```

7. Hit the **Ecto endpoint**:
   ```bash
   curl http://localhost:4000/ecto/authors
   ```

8. Hit the **GraphQL/Dataloader endpoint**:
   ```bash
   curl -X POST http://localhost:4000/graphql \
     -H "Content-Type: application/json" \
     -d '{"query": "{ authors { id name posts { id title body } } }"}'
   ```

   Or open http://localhost:4000/graphiql in a browser.

9. Compare the traces in Sentry (or Spotlight) — look at how Ecto spans differ between the two endpoints.

## Expected Behavior

Both endpoints should produce well-structured traces with visible Ecto query spans under the request/GraphQL operation span.

## Actual Behavior

Compare the trace waterfalls for the two endpoints and observe any differences in how Dataloader-batched queries are represented vs. direct Ecto preloads.

## Environment

- Elixir: >= 1.17
- sentry: ~> 12.0
- Phoenix: ~> 1.8
- Absinthe: ~> 1.7
- Dataloader: ~> 2.0
- OpenTelemetry instrumentation: cowboy, phoenix, ecto, absinthe
