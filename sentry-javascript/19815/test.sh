#!/usr/bin/env bash
# Automated test: starts the server, fires 5 requests, and prints the trace IDs.
# All trace IDs should be the same (the bug), but each should be unique (the fix).

set -e

echo "Starting server..."
node --import ./instrument.js app.js &
SERVER_PID=$!

# Wait for server to be ready
sleep 2

echo ""
echo "Sending 5 requests..."
for i in 1 2 3 4 5; do
  curl -s http://localhost:3000 > /dev/null
  sleep 0.2
done

echo ""
echo "Waiting for events to flush..."
sleep 1

kill $SERVER_PID 2>/dev/null || true
echo "Done."
