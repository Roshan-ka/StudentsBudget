import { describe, expect, it } from 'vitest';
import { pulledRowsOf } from './store';

describe('pulledRowsOf (review F4, 17-11-2026)', () => {
  it('reads sync_pull rows as the app keeps them', () => {
    expect(pulledRowsOf([{ tbl: 'entries', id: 'e1', data: { id: 'e1' }, rev: 7 }])).toEqual([
      { table: 'entries', id: 'e1', data: { id: 'e1' }, rev: 7 },
    ]);
    expect(pulledRowsOf([{ tbl: 'plans', id: 'current', data: null, rev: 8 }])).toEqual([
      { table: 'plans', id: 'current', data: null, rev: 8 },
    ]);
  });

  it('leaves out rows of a retired table, which an account may send until its migration drops it', () => {
    const answer = [
      { tbl: 'guesses', id: 'food', data: { categoryId: 'food' }, rev: 3 },
      { tbl: 'entries', id: 'e1', data: { id: 'e1' }, rev: 4 },
    ];
    expect(pulledRowsOf(answer)).toEqual([{ table: 'entries', id: 'e1', data: { id: 'e1' }, rev: 4 }]);
  });

  it('still refuses a table this app never had', () => {
    expect(() => pulledRowsOf([{ tbl: 'tomorrow', id: 'x', data: null, rev: 1 }])).toThrow();
  });
});
