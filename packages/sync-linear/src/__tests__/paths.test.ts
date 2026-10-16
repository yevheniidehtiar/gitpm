import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveEntityFilePath } from '../paths.js';

describe('resolveEntityFilePath', () => {
  it('returns the filePath as-is when it is already absolute', () => {
    const metaDir = '/repo/.meta';
    const filePath = '/repo/.meta/stories/my-story.md';

    expect(resolveEntityFilePath(metaDir, filePath)).toBe(filePath);
  });

  it('joins a repo-relative filePath onto the metaDir parent', () => {
    const metaDir = '/repo/.meta';
    const filePath = '.meta/stories/my-story.md';

    expect(resolveEntityFilePath(metaDir, filePath)).toBe(
      join('/repo', '.meta/stories/my-story.md'),
    );
  });
});
