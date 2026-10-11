#!/usr/bin/env bash
# Build app/node_modules WITHOUT the npm registry.
#
# Only needed in sandboxes where npm/pypi are blocked but GitHub is reachable (the
# environment Claude builds in). Anywhere with normal internet, just run `npm install`.
#
# What it does:
#   * links React, React DOM, TypeScript, esbuild and tsx from a preinstalled
#     tool folder (TOOLS, default /opt/npm-tools/node_modules)
#   * fetches supabase-js, its realtime dependency, React's types and csstype from
#     GitHub, bundles supabase-js with esbuild and generates its type declarations
#
# Usage:  bash app/scripts/offline-deps.sh
set -euo pipefail

APP="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="${TOOLS:-/opt/npm-tools/node_modules}"
CACHE="$APP/.offline-deps"
NM="$APP/node_modules"
ESBUILD="$TOOLS/@esbuild/linux-x64/bin/esbuild"
TSC="node $TOOLS/typescript/bin/tsc"

mkdir -p "$CACHE"
cd "$CACHE"

clone() { # url dir [sparse paths...]
  local url=$1 dir=$2; shift 2
  [ -d "$dir/.git" ] && return 0
  if [ $# -gt 0 ]; then
    git clone -q --depth 1 --filter=blob:none --sparse "$url" "$dir"
    git -C "$dir" sparse-checkout set "$@"
  else
    git clone -q --depth 1 "$url" "$dir"
  fi
}

echo "fetching sources from GitHub…"
clone https://github.com/supabase/supabase-js supabase-js
clone https://github.com/supabase/phoenix phoenix
clone https://github.com/frenic/csstype csstype
clone https://github.com/DefinitelyTyped/DefinitelyTyped dt types/react types/react-dom

C="$CACHE/supabase-js/packages/core"
T="$CACHE/supabase-js/packages/shared/tracing/src/index.ts"
mkdir -p stubs/iceberg-js
cat > stubs/iceberg-js/index.js <<'EOF'
export class IcebergRestCatalog { constructor() { throw new Error('iceberg not available') } }
export class IcebergError extends Error {}
EOF
cat > stubs/iceberg-js/index.d.ts <<'EOF'
export declare class IcebergRestCatalog { constructor(...args: any[]); [k: string]: any }
export declare class IcebergError extends Error { [k: string]: any }
export type TableIdentifier = any; export type NamespaceIdentifier = any; export type TableSchema = any;
export type CreateTableRequest = any; export type UpdateTableRequest = any; export type TableMetadata = any;
export type CreateNamespaceResponse = any; export type IcebergType = any; export type AccessDelegation = any;
EOF

echo "bundling supabase-js…"
"$ESBUILD" "$C/supabase-js/src/index.ts" --bundle --format=esm --platform=browser \
  --target=es2020 --log-level=error \
  --alias:@supabase/auth-js="$C/auth-js/src/index.ts" \
  --alias:@supabase/functions-js="$C/functions-js/src/index.ts" \
  --alias:@supabase/postgrest-js="$C/postgrest-js/src/index.ts" \
  --alias:@supabase/realtime-js="$C/realtime-js/src/index.ts" \
  --alias:@supabase/storage-js="$C/storage-js/src/index.ts" \
  --alias:@supabase/tracing="$T" \
  --alias:@supabase/phoenix="$CACHE/phoenix/priv/static/phoenix.mjs" \
  --alias:iceberg-js="$CACHE/stubs/iceberg-js/index.js" \
  --alias:tslib="$TOOLS/tslib/tslib.es6.mjs" \
  --outfile="$CACHE/supabase.mjs"

echo "generating supabase-js type declarations…"
cat > tsconfig.decl.json <<EOF
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "declaration": true, "emitDeclarationOnly": true, "outDir": "decl",
    "rootDir": "$C/..", "skipLibCheck": true, "strict": false, "noEmitOnError": false,
    "types": [],
    "paths": {
      "@supabase/auth-js": ["$C/auth-js/src/index.ts"],
      "@supabase/functions-js": ["$C/functions-js/src/index.ts"],
      "@supabase/postgrest-js": ["$C/postgrest-js/src/index.ts"],
      "@supabase/realtime-js": ["$C/realtime-js/src/index.ts"],
      "@supabase/storage-js": ["$C/storage-js/src/index.ts"],
      "@supabase/tracing": ["$T"],
      "@supabase/phoenix": ["$CACHE/phoenix/priv/static/types/index.d.ts"],
      "iceberg-js": ["$CACHE/stubs/iceberg-js/index.d.ts"],
      "tslib": ["$TOOLS/tslib/tslib.d.ts"]
    }
  },
  "files": ["$C/supabase-js/src/index.ts"]
}
EOF
$TSC -p tsconfig.decl.json >/dev/null 2>&1 || true   # upstream source has type nits; declarations still emit

echo "assembling node_modules…"
rm -rf "$NM"
mkdir -p "$NM/@types" "$NM/@supabase" "$NM/.bin"
for p in react react-dom scheduler typescript esbuild tsx tslib playwright playwright-core; do ln -s "$TOOLS/$p" "$NM/$p"; done
mkdir -p "$NM/@esbuild" && ln -s "$TOOLS/@esbuild/linux-x64" "$NM/@esbuild/linux-x64"
ln -s "$CACHE/dt/types/react" "$NM/@types/react"
ln -s "$CACHE/dt/types/react-dom" "$NM/@types/react-dom"
ln -s "$CACHE/csstype" "$NM/csstype"
[ -d "$TOOLS/@types/node" ] && ln -s "$TOOLS/@types/node" "$NM/@types/node"

typespkg() { # name types-dir [module-file]  (types-dir holds index.d.ts)
  local dir="$NM/@supabase/$1"; mkdir -p "$dir"
  ln -s "$2" "$dir/types"
  if [ -n "${3:-}" ]; then
    ln -s "$3" "$dir/index.mjs"
    cat > "$dir/package.json" <<EOF
{ "name": "@supabase/$1", "version": "0.0.0-offline", "type": "module",
  "module": "./index.mjs", "main": "./index.mjs", "types": "./types/index.d.ts",
  "exports": { ".": { "types": "./types/index.d.ts", "default": "./index.mjs" } } }
EOF
  else
    cat > "$dir/package.json" <<EOF
{ "name": "@supabase/$1", "version": "0.0.0-offline", "types": "./types/index.d.ts" }
EOF
  fi
}
D="$CACHE/decl"
typespkg supabase-js "$D/core/supabase-js/src" "$CACHE/supabase.mjs"
typespkg auth-js "$D/core/auth-js/src"
typespkg functions-js "$D/core/functions-js/src"
typespkg postgrest-js "$D/core/postgrest-js/src"
typespkg realtime-js "$D/core/realtime-js/src"
typespkg storage-js "$D/core/storage-js/src"
typespkg tracing "$D/shared/tracing/src"
typespkg phoenix "$CACHE/phoenix/priv/static/types"
mkdir -p "$NM/iceberg-js" && cp "$CACHE/stubs/iceberg-js/"* "$NM/iceberg-js/" \
  && echo '{ "name": "iceberg-js", "types": "index.d.ts", "main": "index.js" }' > "$NM/iceberg-js/package.json"

ln -s ../typescript/bin/tsc "$NM/.bin/tsc"
ln -s ../tsx/dist/cli.mjs "$NM/.bin/tsx"
ln -s ../@esbuild/linux-x64/bin/esbuild "$NM/.bin/esbuild"
echo "done: $NM"
