# Reproduction for sentry-ruby#2813

Validates that the `puma-queue-time` branch captures Puma queue time as `http.server.request.time_in_queue`.

## Setup

Install dependencies:
```bash
bundle install
```

Spotlight is used to inspect transactions locally (no Sentry DSN required). Install via npx (no separate install needed).

## Run

**Terminal 1 - Spotlight tail:**
```bash
npx @spotlightjs/spotlight tail traces --format json
```

**Terminal 2 - Puma server:**
```bash
bundle exec puma -C puma_config.rb
```
Starts server on `http://localhost:9292`

**Terminal 3 - Send test request:**
```bash
ruby simulate_queue.rb
```
Sends request with `X-Request-Start` header simulating 500ms queue time.

## Expected Result

**Spotlight UI (http://localhost:8969):**
- Open in browser to inspect transactions
- Queue time visible at `contexts.trace.data["http.server.request.time_in_queue"]`
- Value: ~500ms

**Spotlight tail output:**
- JSON output showing transaction with queue time in `contexts.trace.data`

## What This Tests

- Puma queue time is extracted from `HTTP_X_REQUEST_START` header
- Stored as `http.server.request.time_in_queue` (milliseconds) in transaction data
- Enabled by default with `config.capture_queue_time = true`
