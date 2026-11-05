import { describe, expect, it } from 'vitest';
import { lastChoiceIn, withLastChoice } from './last-choice';

describe('the entry form remembers its last choice per type', () => {
  it('has nothing before anything is saved, or for what it cannot read', () => {
    expect(lastChoiceIn(null, 'expense')).toBeNull();
    expect(lastChoiceIn('not json', 'expense')).toBeNull();
    expect(lastChoiceIn('[1]', 'expense')).toBeNull();
    expect(lastChoiceIn(JSON.stringify({ expense: { categoryId: 4, accountId: 'a' } }), 'expense')).toBeNull();
  });

  it('keeps expense and income apart', () => {
    let stored = withLastChoice(null, 'expense', { categoryId: 'eating-out', accountId: 'cash' });
    stored = withLastChoice(stored, 'income', { categoryId: 'job', accountId: 'bank' });
    expect(lastChoiceIn(stored, 'expense')).toEqual({ categoryId: 'eating-out', accountId: 'cash' });
    expect(lastChoiceIn(stored, 'income')).toEqual({ categoryId: 'job', accountId: 'bank' });

    stored = withLastChoice(stored, 'expense', { categoryId: 'transport', accountId: 'bank' });
    expect(lastChoiceIn(stored, 'expense')).toEqual({ categoryId: 'transport', accountId: 'bank' });
    expect(lastChoiceIn(stored, 'income')).toEqual({ categoryId: 'job', accountId: 'bank' });
  });
});
