import { describe, expect, it } from 'vitest';
import { parseTree, resolveRefs, validateTree } from './index.js';

describe('@gitpm/core', () => {
  it('exports public API functions', () => {
    expect(typeof parseTree).toBe('function');
    expect(typeof resolveRefs).toBe('function');
    expect(typeof validateTree).toBe('function');
  });
});
