#!/usr/bin/env bash
# One-shot setup for the Vite-in-workerd demo.
#   1. installs the demo app's deps
#   2. installs the harness deps; its postinstall step patches the vendored
#      single-threaded Rolldown so it runs inside workerd, and drops the shim
#      into harness/node_modules/rolldown
set -euo pipefail
cd "$(dirname "$0")"

echo "==> app: install deps"
( cd app && npm install )

echo "==> harness: install deps (postinstall patches Rolldown for single-threaded workerd)"
( cd harness && npm install )

cat <<'EOF'

Setup complete. From harness/, the scripts behave like normal vite — just in workerd:

  cd harness
  npm run dev            # vite dev server INSIDE workerd → open http://localhost:5173
  npm run build          # vite build INSIDE workerd → writes ../app/dist

Proof checks:
  npm run verify:build   # builds on host AND in workerd, byte-compares the dist
  npm run verify:dev     # crawls the dev module graph and reports every status
EOF
