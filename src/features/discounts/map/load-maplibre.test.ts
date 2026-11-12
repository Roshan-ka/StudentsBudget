import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A page whose canvases answer `getContext('webgl2')` with `answer`, counting the canvases made and the probe contexts
 * let go. `canDrawMap` remembers its answer per page (per module), so each case loads the module afresh.
 */
async function pageWith(answer: 'webgl2' | 'none' | 'throws') {
  const made = { canvases: 0, released: 0 };
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`unexpected <${tag}>`);
      made.canvases += 1;
      return {
        getContext: (kind: string) => {
          if (kind !== 'webgl2') return null;
          if (answer === 'throws') throw new Error('blocked');
          if (answer === 'none') return null;
          const loseContext = () => {
            made.released += 1;
          };
          return { getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null) };
        },
      };
    },
  });
  vi.resetModules();
  const { canDrawMap } = await import('./load-maplibre');
  return { canDrawMap, made };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canDrawMap', () => {
  it('asks the browser once per page and lets the probe context go', async () => {
    // React calls it on every render, as a useSyncExternalStore snapshot: a map moving for a few seconds made a WebGL
    // context per frame until the browser dropped the map's own (12-11-2026).
    const { canDrawMap, made } = await pageWith('webgl2');
    for (let frame = 0; frame < 60; frame++) expect(canDrawMap()).toBe(true);
    expect(made.canvases).toBe(1);
    expect(made.released).toBe(1);
  });

  it('remembers a browser without WebGL 2 too', async () => {
    const { canDrawMap, made } = await pageWith('none');
    expect(canDrawMap()).toBe(false);
    expect(canDrawMap()).toBe(false);
    expect(made.canvases).toBe(1);
  });

  it('takes a refused probe as no WebGL 2, once', async () => {
    const { canDrawMap, made } = await pageWith('throws');
    expect(canDrawMap()).toBe(false);
    expect(canDrawMap()).toBe(false);
    expect(made.canvases).toBe(1);
  });
});
