import { describe, expect, it } from 'vitest';
import { firstRunPath, firstRunPathSoon, sessionMayBeStored } from './first-run';

describe('firstRunPath', () => {
  it('waits while the sign-in state is still being read', () => {
    expect(firstRunPath('loading')).toBeNull();
  });

  it('shows the start page while nobody is signed in', () => {
    expect(firstRunPath('signed-out')).toBe('/start');
  });

  it('opens the code step for a session that still needs its authenticator code', () => {
    expect(firstRunPath('second-step')).toBe('/start/sign-in');
  });

  it('goes to setup once signed in, and in a build without accounts', () => {
    expect(firstRunPath('signed-in')).toBe('/setup');
    expect(firstRunPath('off')).toBe('/setup');
  });
});

describe('firstRunPathSoon (review P4, 17-11-2026)', () => {
  it('opens the start page at once when no session can be on this phone', () => {
    expect(firstRunPathSoon('loading', false)).toBe('/start');
  });

  it('waits for the sign-in state when a session may be stored', () => {
    expect(firstRunPathSoon('loading', true)).toBeNull();
  });

  it('follows the sign-in state once it is known', () => {
    expect(firstRunPathSoon('signed-in', false)).toBe('/setup');
    expect(firstRunPathSoon('second-step', true)).toBe('/start/sign-in');
    expect(firstRunPathSoon('off', false)).toBe('/setup');
  });
});

describe('sessionMayBeStored', () => {
  it('looks for supabase-js’s key', () => {
    expect(sessionMayBeStored({ getItem: () => null })).toBe(false);
    expect(sessionMayBeStored({ getItem: () => '{"access_token":"x"}' })).toBe(true);
  });

  it('counts blocked storage as maybe', () => {
    expect(
      sessionMayBeStored({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe(true);
  });
});
