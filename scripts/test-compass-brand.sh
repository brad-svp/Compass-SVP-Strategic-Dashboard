#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
pnpm --filter @workspace/api-server exec esbuild ../svp-os/tests/brand.test.tsx \
  --bundle --platform=node --format=cjs --jsx=automatic \
  --tsconfig=../svp-os/tsconfig.json \
  "--alias:react=$root/artifacts/svp-os/node_modules/react" \
  "--alias:react-dom=$root/artifacts/svp-os/node_modules/react-dom" \
  "--outfile=$out/brand.cjs" --log-level=warning
node --test "$out/brand.cjs"
