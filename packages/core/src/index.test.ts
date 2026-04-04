import { describe, expect, it } from 'vitest';
import { name } from './index.js';

describe('@gitpm/core', () => {
  it('exports package name', () => {
    expect(name).toBe('@gitpm/core');
  });
});
