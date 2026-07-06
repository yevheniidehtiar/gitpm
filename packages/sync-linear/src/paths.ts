import { dirname, isAbsolute, join } from 'node:path';

/**
 * Resolves an entity's `filePath` to an absolute path on disk.
 *
 * `parseTree` returns entities whose `filePath` is already absolute (it is
 * built from `metaDir`, which the CLI resolves via `resolve(process.cwd(),
 * ...)`). Freshly-created entities (e.g. from `determineFilePath`) instead
 * carry a repo-relative path like `.meta/stories/foo.md`. Naively doing
 * `join(metaDir, '..', entity.filePath)` assumes the latter and produces a
 * garbage nested path for the former (e.g. `<root>/.meta/.meta/stories/...`
 * doubled under the repo root), silently writing sync metadata to the wrong
 * file. Branch on `isAbsolute` so both cases resolve correctly.
 */
export function resolveEntityFilePath(
  metaDir: string,
  filePath: string,
): string {
  return isAbsolute(filePath) ? filePath : join(dirname(metaDir), filePath);
}
