import { describe, expect, it } from 'vitest';
import { firstRunPath } from './first-run';

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
