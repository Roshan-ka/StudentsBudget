import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_PREF, aiInBuild, aiOnHere } from './switch';

let stored: Record<string, string>;

beforeEach(() => {
  stored = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => {
      stored[key] = value;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function supabaseBuild() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
}

describe('aiInBuild', () => {
  it('needs a Supabase project and NEXT_PUBLIC_AI=1', () => {
    supabaseBuild();
    vi.stubEnv('NEXT_PUBLIC_AI', '1');
    expect(aiInBuild()).toBe(true);
  });

  it('is off until go-live sets NEXT_PUBLIC_AI, and for any other value', () => {
    supabaseBuild();
    vi.stubEnv('NEXT_PUBLIC_AI', '');
    expect(aiInBuild()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_AI', 'true');
    expect(aiInBuild()).toBe(false);
  });

  it('is off without a Supabase project: there is nobody to sign in', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_AI', '1');
    expect(aiInBuild()).toBe(false);
  });
});

describe('aiOnHere', () => {
  it('is on for a phone that never chose, and off once switched off', () => {
    expect(aiOnHere()).toBe(true);
    stored[AI_PREF] = 'off';
    expect(aiOnHere()).toBe(false);
    stored[AI_PREF] = 'on';
    expect(aiOnHere()).toBe(true);
  });

  it('reads blocked storage as on, the default, like every per-phone choice', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(aiOnHere()).toBe(true);
  });
});
