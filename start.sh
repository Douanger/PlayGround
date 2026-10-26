#!/usr/bin/env bash
set -euo pipefail

START_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$START_DIR" && pwd)"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
BUILD_DIR="$PROJECT_DIR/dist"
PORT="${PORT:-3000}"
export PORT

echo "start.sh: project=$PROJECT_DIR build=$BUILD_DIR port=$PORT"

/usr/bin/time -p mkdir -p "$WEB_DIR" "$BUILD_DIR"

if [ -f "$PROJECT_DIR/package.json" ] && /usr/bin/time -p node -e '
const { readFileSync } = require("node:fs")
const p = JSON.parse(readFileSync(process.argv[1], "utf8"))
process.exit(Object.keys({ ...p.dependencies, ...p.devDependencies }).length ? 0 : 1)
' "$PROJECT_DIR/package.json"; then
  if [ -f "$PROJECT_DIR/package-lock.json" ]; then
    /usr/bin/time -p npm --prefix "$PROJECT_DIR" ci --no-audit --no-fund
  else
    /usr/bin/time -p npm --prefix "$PROJECT_DIR" install --no-audit --no-fund
  fi
fi

/usr/bin/time -p node "$PROJECT_DIR/build.mjs"

/usr/bin/time -p node -e '
const { writeFileSync } = require("node:fs")
const [project, directory, file] = process.argv.slice(1)
writeFileSync(file, JSON.stringify({ project, directory }))
' "$PROJECT_DIR" "$BUILD_DIR" "$WEB_DIR/deployment-output.json"

if [ ! -f "$BUILD_DIR/index.html" ]; then
  echo "start.sh: build output is missing index.html" >&2
  exit 1
fi

echo "start.sh: serving $BUILD_DIR in the foreground"
exec /usr/bin/time -p node "$PROJECT_DIR/server.mjs"
