#!/usr/bin/env bash
set -euo pipefail

START_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTURE_URL="${CAPTURE_URL:?Set CAPTURE_URL}"
CAPTURE_DIR="${CAPTURE_DIR:?Set CAPTURE_DIR}"
export CAPTURE_URL CAPTURE_DIR

TOTAL_START="$(date +%s%3N)"
finish() {
  local code=$?
  local elapsed=$(( $(date +%s%3N) - TOTAL_START ))
  echo "[timing] capture.sh total: ${elapsed} ms (exit ${code})" >&2
  exit "$code"
}
trap finish EXIT

case "$CAPTURE_URL" in
  http://*|https://*) ;;
  *) echo "capture.sh: CAPTURE_URL must be an http(s) URL" >&2; exit 1 ;;
esac

case "$(realpath -m "$CAPTURE_DIR")" in
  "$START_DIR"|"$START_DIR"/*)
    echo "capture.sh: CAPTURE_DIR must stay outside the project source tree" >&2
    exit 1
    ;;
esac

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p node "$START_DIR/scripts/capture.mjs"
