/**
 * Shared helpers for CLI integration tests.
 *
 * These build *real* temp `.meta/` trees on disk (via `mkdtemp`) so that the
 * integration tests exercise the real `@gitpm/core` parser/writer and the
 * real `@gitpm/sync-github` adapter code, instead of mocking at the adapter
 * boundary like the existing `*.test.ts` unit tests do.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface TempProject {
  /** The project root directory (parent of `.meta`). */
  rootDir: string;
  /** The `.meta` directory inside the project root. */
  metaDir: string;
}

// Temp project roots are created *inside* `packages/cli/` (under a
// gitignored `.tmp-integration/` directory) rather than under the OS temp
// dir. This matters: `gitpm import|push|pull|sync` resolve real adapter
// packages (e.g. `@gitpm/sync-github`) via `@gitpm/core`'s dynamic
// `loadAdapters`, which falls back to scanning `node_modules` directories
// found by walking *up* from the project root when a plain bare `import()`
// fails to resolve (as happens under vitest's module loader for a package
// that Bun only symlinked into `packages/cli/node_modules`, not the
// workspace root). Rooting temp projects under `packages/cli/` means that
// walk-up reaches `packages/cli/node_modules/@gitpm/sync-*` and the real
// adapter package loads — an OS tmp dir (e.g. `/tmp/...`) has no such
// ancestor and `loadAdapters` would silently return zero adapters.
const CLI_PACKAGE_DIR = dirname(
  dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
);
const TMP_ROOT = join(CLI_PACKAGE_DIR, '.tmp-integration');

/**
 * Create a fresh temp directory to use as a project root. The `.meta`
 * directory itself is NOT created — callers write into it as needed (some
 * tests, like `import`, expect `.meta` not to exist yet).
 */
export async function createTempProject(prefix: string): Promise<TempProject> {
  await mkdir(TMP_ROOT, { recursive: true });
  const rootDir = await mkdtemp(join(TMP_ROOT, prefix));
  const metaDir = join(rootDir, '.meta');
  return { rootDir, metaDir };
}

/**
 * Write a Markdown entity file with YAML frontmatter, mirroring the shape of
 * real `.meta/` files (see `packages/core/src/__fixtures__/valid-tree` and
 * `packages/ui/e2e/fixtures/.meta`).
 */
export async function writeEntityFile(
  filePath: string,
  frontmatter: Record<string, unknown>,
  body = '',
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    lines.push(...renderFrontmatterField(key, value));
  }
  lines.push('---');
  const content = `${lines.join('\n')}\n\n${body}\n`;
  await writeFile(filePath, content, 'utf-8');
}

function renderFrontmatterField(key: string, value: unknown): string[] {
  if (value === null || value === undefined) {
    return [`${key}: null`];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${key}: []`];
    return [`${key}:`, ...value.map((item) => `  - ${JSON.stringify(item)}`)];
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return [
      `${key}:`,
      ...entries.map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`),
    ];
  }
  if (typeof value === 'string') {
    return [`${key}: ${JSON.stringify(value)}`];
  }
  return [`${key}: ${value}`];
}

/** Write a `.meta/roadmap/roadmap.yaml` file (no frontmatter delimiters — plain YAML). */
export async function writeRoadmapFile(
  filePath: string,
  data: Record<string, unknown>,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    lines.push(...renderFrontmatterField(key, value));
  }
  await writeFile(filePath, `${lines.join('\n')}\n`, 'utf-8');
}

/** Write the GitHub sync adapter config (`.meta/sync/github-config.yaml`). */
export async function writeGithubSyncConfig(
  metaDir: string,
  repo: string,
): Promise<void> {
  const configPath = join(metaDir, 'sync', 'github-config.yaml');
  await mkdir(dirname(configPath), { recursive: true });
  const content = [
    `repo: ${repo}`,
    'status_mapping: {}',
    'label_mapping:',
    '  epic_labels:',
    '    - epic',
    'priority_mapping: {}',
    'auto_sync: false',
    '',
  ].join('\n');
  await writeFile(configPath, content, 'utf-8');
}
