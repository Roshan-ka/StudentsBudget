import { describe, expect, it } from 'vitest';
import { pageTitle } from './page-title';

describe('pageTitle', () => {
  it('names the page first, then the app', () => {
    expect(pageTitle('Settings')).toBe('Settings · StudentsBudget');
    expect(pageTitle('Einstellungen')).toBe('Einstellungen · StudentsBudget');
  });
});
