#!/usr/bin/env bash
# Boots a throwaway Redis, enqueues jobs, and runs Sidekiq with 5 worker threads
# for a few seconds. Prints any exception raised out of the job/middleware.
set -uo pipefail
cd "$(dirname "$0")"

REDIS_PORT="${REDIS_PORT:-6399}"
export REDIS_URL="redis://localhost:${REDIS_PORT}/0"

if ! redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
  echo "starting redis on port ${REDIS_PORT}..."
  redis-server --port "$REDIS_PORT" --save '' --appendonly no --daemonize yes
  trap 'redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1' EXIT
  for _ in $(seq 20); do redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1 && break; sleep 0.2; done
fi

redis-cli -p "$REDIS_PORT" flushall >/dev/null
bundle exec ruby enqueue.rb

echo "running sidekiq (concurrency 5) for ${DURATION:-12}s..."
out=$(mktemp)
bundle exec sidekiq -r ./sidekiq_app.rb -c 5 -q default >"$out" 2>&1 &
pid=$!
sleep "${DURATION:-12}"
kill -TERM "$pid" 2>/dev/null
wait "$pid" 2>/dev/null

echo
if grep -q "REPRODUCED" "$out"; then
  echo "=== REPRODUCED - exceptions escaped the Sentry Sidekiq middleware ==="
  grep "REPRODUCED" "$out" | sort | uniq -c
  status=1
else
  echo "=== No exceptions - profiler contention was handled gracefully ==="
  status=0
fi
grep -h "### envelope items" "$out" || true
echo
echo "(full sidekiq log: $out)"
exit $status
