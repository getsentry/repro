#!/bin/bash
# Reproduction script for sentry-javascript#17742
# Background job breadcrumbs leaking into HTTP request error events

echo "=== Starting NestJS server ==="
node dist/main.js &
APP_PID=$!

echo "Waiting for server to start and background jobs to run..."
sleep 10

echo ""
echo "=== Triggering error after background jobs have polluted the default scope ==="
curl -s http://localhost:3000/trigger-error
echo ""

sleep 3
kill $APP_PID 2>/dev/null
wait $APP_PID 2>/dev/null
