import { describe, expect, it } from 'vitest';
import { resolveMetaDir } from '../utils/config.js';

describe('resolveMetaDir', () => {
  it('resolves a relative path against the current working directory', () => {
    const result = resolveMetaDir('.meta');
    expect(result).toBe(`${process.cwd()}/.meta`);
  });

  it('resolves a nested relative path', () => {
    const result = resolveMetaDir('some/nested/.meta');
    expect(result).toBe(`${process.cwd()}/some/nested/.meta`);
  });

  it('leaves an already-absolute path unchanged', () => {
    const result = resolveMetaDir('/tmp/project/.meta');
    expect(result).toBe('/tmp/project/.meta');
  });
});
