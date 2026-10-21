#!/usr/bin/env node
/**
 * Replace `workspace:*` dependency ranges with the real versions of the
 * workspace packages, so `npm publish` produces installable tarballs.
 *
 * Bun resolves the `workspace:` protocol when it publishes, but npm does not,
 * and the release workflow has to use npm for trusted publishing (OIDC).
 * Run this once from the repo root right before publishing. It rewrites every
 * package.json under the root `workspaces` globs in place.
 *
 *   node scripts/resolve-workspace-deps.mjs            # rewrite
 *   node scripts/resolve-workspace-deps.mjs --dry-run  # print, do not write
 *
 * Runtime dependencies get the exact version, matching what `bun publish`
 * writes for `workspace:*`. Peer dependencies get a caret range so a CLI
 * release keeps working with later adapter patches.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const WORKSPACE_PREFIX = 'workspace:';
const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

/** Expand `packages/*`-style globs from the root package.json. */
async function workspaceDirs() {
  const rootPkg = await readJson(join(root, 'package.json'));
  const dirs = [];
  for (const pattern of rootPkg.workspaces ?? []) {
    if (!pattern.endsWith('/*')) {
      dirs.push(join(root, pattern));
      continue;
    }
    const parent = join(root, pattern.slice(0, -2));
    for (const entry of await readdir(parent, { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.push(join(parent, entry.name));
    }
  }
  return dirs;
}

function resolveRange(range, version, field) {
  const spec = range.slice(WORKSPACE_PREFIX.length);
  if (spec === '^' || spec === '~') return `${spec}${version}`;
  if (spec !== '*' && spec !== '') return spec;
  return field === 'peerDependencies' ? `^${version}` : version;
}

const dirs = await workspaceDirs();
const manifests = new Map();
for (const dir of dirs) {
  try {
    manifests.set(dir, await readJson(join(dir, 'package.json')));
  } catch {
    // A workspace directory without a package.json is not a package.
  }
}
const versions = new Map(
  [...manifests.values()].map((pkg) => [pkg.name, pkg.version]),
);

let rewritten = 0;
for (const [dir, pkg] of manifests) {
  let changed = false;
  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range !== 'string' || !range.startsWith(WORKSPACE_PREFIX)) {
        continue;
      }
      const version = versions.get(name);
      if (!version) {
        console.error(
          `${pkg.name}: ${field}.${name} is ${range} but no workspace package is named ${name}`,
        );
        process.exit(1);
      }
      deps[name] = resolveRange(range, version, field);
      console.log(`${pkg.name}: ${field}.${name} ${range} -> ${deps[name]}`);
      changed = true;
      rewritten += 1;
    }
  }
  if (changed && !dryRun) {
    await writeFile(
      join(dir, 'package.json'),
      `${JSON.stringify(pkg, null, 2)}\n`,
      'utf-8',
    );
  }
}

console.log(
  `${dryRun ? 'Would rewrite' : 'Rewrote'} ${rewritten} workspace range(s) in ${manifests.size} package(s).`,
);
