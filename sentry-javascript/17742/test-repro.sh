#!/bin/bash
# Reproduction script for sentry-javascript#17742
# Tests breadcrumb leaking from all background job frameworks:
#   - @nestjs/schedule (always active)
#   - @nestjs/event-emitter (always active)
#   - @nestjs/bullmq (requires REDIS_URL)
#   - nestjs-graphile-worker (requires DATABASE_URL)

echo "=== Starting NestJS server ==="
node dist/main.js &
APP_PID=$!

echo "Waiting for server to start and background jobs to run..."
sleep 18

echo ""
echo "=== Triggering error to check for leaked breadcrumbs ==="
curl -s http://localhost:3000/trigger-error
echo ""

sleep 3
kill $APP_PID 2>/dev/null
wait $APP_PID 2>/dev/null
