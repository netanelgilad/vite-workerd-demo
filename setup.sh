#!/usr/bin/env bash
# One-shot setup for the Vite-in-workerd demo.
#   1. installs the demo app's deps and produces a host-Node `vite build`
#      (the byte-compare baseline for `npm run verify`)
#   2. installs the harness deps; its postinstall step patches the vendored
#      single-threaded Rolldown so it runs inside workerd, and drops the shim
#      into harness/node_modules/rolldown
set -euo pipefail
cd "$(dirname "$0")"

echo "==> app: install deps + host-Node baseline build"
( cd app && npm install && npx vite build )

echo "==> harness: install deps (postinstall patches Rolldown for single-threaded workerd)"
( cd harness && npm install )

cat <<'EOF'

Setup complete. Run the demo:

  cd harness
  npm run verify   # vite build INSIDE workerd, byte-compared to the host build
  npm run dev      # vite dev server INSIDE workerd, crawled like a browser
  npm run build    # vite build INSIDE workerd, prints dist + timing
EOF
