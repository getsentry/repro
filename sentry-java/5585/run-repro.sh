#!/usr/bin/env bash
#
# Reproduces getsentry/sentry-java#5585 — the flaky ComposeMaskingOptionsTest.
#
# The test only flakes when the WHOLE ComposeMaskingOptionsTest class runs (test
# interaction / Robolectric layout timing), so we run the full class repeatedly
# with --rerun-tasks (Gradle would otherwise cache a passing result) and count
# how often it fails.
#
# Configuration via env vars:
#   SENTRY_JAVA_DIR   Path to a sentry-java checkout. If unset, the repo is
#                     cloned into ./sentry-java next to this script.
#   ITERATIONS        Number of times to run the test class (default: 20).
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ITERATIONS="${ITERATIONS:-20}"
TEST_CLASS="io.sentry.android.replay.viewhierarchy.ComposeMaskingOptionsTest"

if [[ -z "${SENTRY_JAVA_DIR:-}" ]]; then
  SENTRY_JAVA_DIR="${SCRIPT_DIR}/sentry-java"
  if [[ ! -d "${SENTRY_JAVA_DIR}" ]]; then
    echo "Cloning sentry-java into ${SENTRY_JAVA_DIR} ..."
    git clone --depth 1 https://github.com/getsentry/sentry-java.git "${SENTRY_JAVA_DIR}"
  fi
fi

echo "Using sentry-java at: ${SENTRY_JAVA_DIR}"
echo "Commit: $(git -C "${SENTRY_JAVA_DIR}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "Running ${TEST_CLASS} ${ITERATIONS} times ..."
echo

pass=0
fail=0
for i in $(seq 1 "${ITERATIONS}"); do
  out="$(cd "${SENTRY_JAVA_DIR}" && ./gradlew :sentry-android-replay:testReleaseUnitTest \
    --tests "${TEST_CLASS}" --rerun-tasks --console=plain 2>&1)"
  if echo "${out}" | grep -q "BUILD SUCCESSFUL"; then
    pass=$((pass + 1))
    echo "run ${i}: PASS"
  else
    fail=$((fail + 1))
    echo "run ${i}: FAIL"
    echo "${out}" | grep "should be masked" | head -1
  fi
done

echo
echo "=== PASS=${pass} FAIL=${fail} (of ${ITERATIONS}) ==="
[[ ${fail} -gt 0 ]] && echo "Reproduced the flake." || echo "No failure this time — rerun; the flake is intermittent (~10%)."
