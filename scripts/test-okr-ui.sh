#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
# Match Vite's automatic JSX transform and React deduplication without starting
# a test-only auth bypass or modifying any runtime authentication.
pnpm --filter @workspace/api-server exec esbuild ../svp-os/tests/okr-ui.test.tsx \
  --bundle --platform=node --format=cjs --jsx=automatic \
  --tsconfig=../svp-os/tsconfig.json \
  '--define:import.meta.env.BASE_URL="/"' \
  "--alias:react=$root/artifacts/svp-os/node_modules/react" \
  "--alias:react-dom=$root/artifacts/svp-os/node_modules/react-dom" \
  "--outfile=$out/okr-ui.cjs" --log-level=warning
node --test "$out/okr-ui.cjs"
for suite in narrative-plan-brain-ui dashboard-timeline; do
  pnpm --filter @workspace/api-server exec esbuild "../svp-os/tests/$suite.test.tsx" \
    --bundle --platform=node --format=cjs --jsx=automatic \
    --tsconfig=../svp-os/tsconfig.json \
    '--define:import.meta.env.BASE_URL="/"' \
    "--alias:react=$root/artifacts/svp-os/node_modules/react" \
    "--alias:react-dom=$root/artifacts/svp-os/node_modules/react-dom" \
    "--outfile=$out/$suite.cjs" --log-level=warning
  node --test "$out/$suite.cjs"
done
