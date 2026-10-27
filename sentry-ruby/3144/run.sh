#!/usr/bin/env bash
# Boots a throwaway Redis, then boots Sidekiq (with sidekiq-scheduler firing
# ScheduledJob every second) BOOTS times for DURATION seconds each, and
# summarizes trace_id / sample_rand / sampled per boot.
set -uo pipefail
cd "$(dirname "$0")"

BOOTS="${BOOTS:-4}"
DURATION="${DURATION:-8}"
REDIS_PORT="${REDIS_PORT:-6399}"
# Sidekiq 8 needs Redis >= 7 (or Valkey). Override if your binaries differ.
REDIS_SERVER="${REDIS_SERVER:-redis-server}"
REDIS_CLI="${REDIS_CLI:-redis-cli}"
export REDIS_URL="redis://localhost:${REDIS_PORT}/0"
export RESULTS_LOG="${RESULTS_LOG:-$PWD/results.log}"

if ! "$REDIS_CLI" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
  "$REDIS_SERVER" --port "$REDIS_PORT" --save '' --appendonly no --daemonize yes >/dev/null
  trap '"$REDIS_CLI" -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1' EXIT
  for _ in $(seq 20); do "$REDIS_CLI" -p "$REDIS_PORT" ping >/dev/null 2>&1 && break; sleep 0.2; done
fi

rm -f "$RESULTS_LOG"
for boot in $(seq 1 "$BOOTS"); do
  "$REDIS_CLI" -p "$REDIS_PORT" flushall >/dev/null
  BOOT="$boot" bundle exec sidekiq -r ./app.rb -c 2 >"sidekiq-$boot.log" 2>&1 &
  pid=$!
  sleep "$DURATION"
  kill -TERM "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
done

bundle exec ruby summarize.rb "$RESULTS_LOG"
