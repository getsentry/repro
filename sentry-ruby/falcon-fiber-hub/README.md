# Falcon + fiber hub storage repro

Exercises `config.hub_isolation_level` (branch `feat/fiber-hub-storage`) under a
real fiber-per-request server. Falcon schedules concurrent requests as sibling
fibers on one reactor thread, so a request that yields mid-flight lets its
siblings run. With `:thread` storage they share one hub and stomp each other's
scope; with `:fiber` storage each request keeps its own.

Ruby is pinned via `.mise.toml`; prefix commands with `mise exec --`.

## Setup

```bash
mise install
mise exec -- bundle install
```

## Run

```bash
mise run serve &

# hammer it with interleaved ids
seq 0 20 | xargs -P 20 -I{} curl -s "http://localhost:9292/?id={}"
```
