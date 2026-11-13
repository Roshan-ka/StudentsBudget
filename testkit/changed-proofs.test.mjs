import { describe, expect, it } from 'vitest';
import { specsToProve } from './changed-proofs.mjs';

const mutationFiles = [
  { path: 'e2e/mutations/a.json', mutations: [{ file: 'src/a.ts', edits: [{ file: 'src/a.ts' }], expect: { 'e2e/a.spec.ts': ['x'] } }] },
  { path: 'e2e/mutations/b.json', mutations: [{ file: 'src/b.ts', edits: [{ file: 'src/b.ts' }, { file: 'db/b.sql' }], expect: { 'e2e/b.spec.ts': ['y'], 'e2e/c.spec.ts': ['z'] } }] },
];

describe('specsToProve', () => {
  it('proves a changed spec again, when a saved mutation names it', () => {
    expect(specsToProve({ changed: ['e2e/a.spec.ts', 'e2e/unnamed.spec.ts'], mutationFiles })).toEqual(['e2e/a.spec.ts']);
  });

  it('proves every spec of a changed mutations file, and of a mutation whose target changed', () => {
    expect(specsToProve({ changed: ['e2e/mutations/b.json'], mutationFiles })).toEqual(['e2e/b.spec.ts', 'e2e/c.spec.ts']);
    expect(specsToProve({ changed: ['src/a.ts'], mutationFiles })).toEqual(['e2e/a.spec.ts']);
  });

  it('proves nothing for a change no mutation reaches', () => {
    expect(specsToProve({ changed: ['README.md', 'src/other.ts'], mutationFiles })).toEqual([]);
  });
});

describe('specsToProve with several edits', () => {
  it('proves the specs of a mutation when any of its files changed', () => {
    expect(specsToProve({ changed: ['db/b.sql'], mutationFiles })).toEqual(['e2e/b.spec.ts', 'e2e/c.spec.ts']);
  });
});
