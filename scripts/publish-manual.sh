#!/usr/bin/env bash
# One-off manual publish of workspace packages to npm.
#
# Normal releases go through .github/workflows/release.yml with trusted
# publishing. This script is for the cases that workflow cannot handle: a
# package that does not exist on npm yet (a trusted publisher can only be
# configured on an existing package), or a recovery publish from a laptop.
#
# Usage:
#   scripts/publish-manual.sh <package-dir>...          # dry run (default)
#   scripts/publish-manual.sh --publish <package-dir>...
#   scripts/publish-manual.sh --publish --missing      # every package whose
#                                                      # current version is
#                                                      # not on npm yet
#
# <package-dir> is the directory name under packages/, e.g. sync-linear.
#
# Steps: npm whoami check, bun install, bun run build, rewrite workspace:*
# ranges with scripts/resolve-workspace-deps.mjs, npm publish per package,
# then restore every package.json from git, also on failure.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

mode="dry-run"
missing=0
targets=()
for arg in "$@"; do
  case "$arg" in
    --publish) mode="publish" ;;
    --dry-run) mode="dry-run" ;;
    --missing) missing=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) targets+=("$arg") ;;
  esac
done

if [[ $missing -eq 1 ]]; then
  for dir in packages/*/; do
    name="$(node -p "require('./${dir}package.json').name")"
    version="$(node -p "require('./${dir}package.json').version")"
    if npm view "${name}@${version}" version >/dev/null 2>&1; then
      echo "skip  ${name}@${version} (already on npm)"
    else
      targets+=("$(basename "$dir")")
    fi
  done
fi

if [[ ${#targets[@]} -eq 0 ]]; then
  echo "Nothing to publish. Pass package directory names or --missing." >&2
  exit 1
fi

for t in "${targets[@]}"; do
  if [[ ! -f "packages/$t/package.json" ]]; then
    echo "packages/$t/package.json not found" >&2
    exit 1
  fi
done

if ! /usr/bin/git diff --quiet -- 'packages/*/package.json'; then
  echo "Package manifests have uncommitted changes; commit or revert them first." >&2
  exit 1
fi

if [[ $mode == "publish" ]]; then
  user="$(npm whoami 2>/dev/null || true)"
  if [[ -z "$user" ]]; then
    echo "Not logged in to npm. Run: npm login" >&2
    exit 1
  fi
  echo "Publishing as npm user: $user"
fi

restore() {
  /usr/bin/git checkout -- 'packages/*/package.json'
}
trap restore EXIT

echo "==> bun install"
bun install
echo "==> bun run build"
bun run build
echo "==> resolve workspace:* ranges"
node scripts/resolve-workspace-deps.mjs

for t in "${targets[@]}"; do
  name="$(node -p "require('./packages/$t/package.json').name")"
  version="$(node -p "require('./packages/$t/package.json').version")"
  echo "==> ${name}@${version}"
  if [[ $mode == "publish" ]]; then
    (cd "packages/$t" && npm publish --access public)
  else
    (cd "packages/$t" && npm publish --access public --dry-run)
  fi
done

if [[ $mode == "dry-run" ]]; then
  echo
  echo "Dry run only. Re-run with --publish to publish for real."
fi
