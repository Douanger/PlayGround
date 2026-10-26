#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
PORT="${PORT:-3000}"
OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
BUILD_DIR="$PROJECT_DIR/dist"

if [[ -f package.json ]]; then
  if [[ -f package-lock.json ]]; then
    /usr/bin/time -p npm ci --no-audit --no-fund
  else
    /usr/bin/time -p npm install --no-audit --no-fund
  fi
fi

needs_build=false
if [[ ! -f "$BUILD_DIR/index.html" ]]; then
  needs_build=true
elif [[ -f index.html && index.html -nt "$BUILD_DIR/index.html" ]]; then
  needs_build=true
fi

if [[ "$needs_build" == true ]]; then
  if [[ -f package.json ]] && node -e "const p=require('./package.json'); process.exit(p.scripts&&p.scripts.build?0:1)" 2>/dev/null; then
    /usr/bin/time -p npm run build
  else
    /usr/bin/time -p mkdir -p "$BUILD_DIR"
    if [[ -f index.html ]]; then
      /usr/bin/time -p cp index.html "$BUILD_DIR/index.html"
    fi
  fi
fi

if [[ ! -f "$BUILD_DIR/index.html" ]]; then
  echo "Missing built index.html" >&2
  exit 1
fi

/usr/bin/time -p mkdir -p "$OPENCODE_WEB_DIR"
/usr/bin/time -p node -e "const fs=require('fs'); fs.writeFileSync(process.argv[1], JSON.stringify({project:process.argv[2],directory:process.argv[3]}))" "$OPENCODE_WEB_DIR/deployment-output.json" "$PROJECT_DIR" "$BUILD_DIR"

cd "$BUILD_DIR"
exec /usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0
