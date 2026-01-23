#!/bin/bash

# Validation script to check if queue time is captured
# This script looks for queue_time in the transaction data

echo "Starting Spotlight tail in background..."
echo "Looking for 'queue_time' in transaction data..."
echo ""

# Start spotlight tail and grep for queue_time
npx @spotlightjs/spotlight tail traces --format json 2>/dev/null | \
  jq -r 'select(.type == "transaction") |
    "Transaction: \(.transaction // "unknown")",
    "Duration: \(.timestamp - .start_timestamp)s",
    "Queue time attribute: \(if has("queue_time") or has("queue_time_ms") then "FOUND ✓" else "NOT FOUND ✗" end)",
    "Context keys: \(.contexts | keys)",
    "Extra keys: \(if .extra then .extra | keys else [] end)",
    "---"'
