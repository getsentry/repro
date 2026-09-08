#!/usr/bin/env bash
# Runs threads_repro.rb against several sentry-ruby versions to show when this was fixed.
set -uo pipefail
cd "$(dirname "$0")"

VERSIONS="${VERSIONS:-5.21.0 5.22.0 5.23.0 7.0.0}"

for v in $VERSIONS; do
  echo "================ sentry-ruby $v ================"
  SENTRY_VERSION="$v" bundle install --quiet >/dev/null 2>&1 || { echo "bundle install failed"; continue; }
  SENTRY_VERSION="$v" bundle exec ruby threads_repro.rb 2>&1 | grep -vE "^[WD], \[" 
  echo
done
