import { describe, expect, it } from 'vitest';
import { CORE_FLEXIBLE_IDS } from '@/data/categories';
import type { Account } from '@/db/types';
import { FLEXIBLE_CATEGORIES } from '@/features/entries/categories';
import type { ReceiptReading } from './read-receipt';
import { chipIds, draftOf } from './scan';

// The receipt scan's card apart from React: the fields a scan starts it with, and the category chips it shows.

function account(id: string, kind: Account['kind'], currency: Account['currency'], day: number, isDefault?: true): Account {
  return {
    id,
    name: id,
    kind,
    currency,
    openingMinor: 0,
    createdAt: `2026-10-0${day}T08:00:00.000Z`,
    ...(isDefault && { isDefault }),
  };
}

const ACCOUNTS = [account('cash', 'cash', 'EUR', 1), account('home', 'bank', 'INR', 2), account('local', 'bank', 'EUR', 3)];
const TODAY = '2026-11-16';
const REWE: ReceiptReading = { amountMinor: 2345, date: '2026-11-14', shop: 'REWE', note: 'REWE', categoryId: 'food' };

describe('draftOf', () => {
  it('fills the card from the reading, with the amount as the language writes it, on the default account', () => {
    expect(draftOf(REWE, ACCOUNTS, TODAY, 'en-IE')).toEqual({
      found: true,
      draft: { amount: '23.45', date: '2026-11-14', note: 'REWE', categoryId: 'food', accountId: 'local' },
    });
    expect(draftOf(REWE, ACCOUNTS, TODAY, 'de-DE').draft.amount).toBe('23,45');
  });

  it('takes the account the student marked as the default', () => {
    const accounts = [...ACCOUNTS, account('n26', 'bank', 'EUR', 4, true)];
    expect(draftOf(REWE, accounts, TODAY, 'en-IE').draft.accountId).toBe('n26');
  });

  it('dates a receipt without a readable date today', () => {
    expect(draftOf({ ...REWE, date: null }, ACCOUNTS, TODAY, 'en-IE').draft.date).toBe(TODAY);
  });

  it('is not found without a total, keeping whatever else was read', () => {
    expect(draftOf({ ...REWE, amountMinor: null }, ACCOUNTS, TODAY, 'en-IE')).toEqual({
      found: false,
      draft: { amount: '', date: '2026-11-14', note: 'REWE', categoryId: 'food', accountId: 'local' },
    });
  });

  it('starts empty when nothing could be read, dated today on the default account', () => {
    expect(draftOf(null, ACCOUNTS, TODAY, 'en-IE')).toEqual({
      found: false,
      draft: { amount: '', date: TODAY, note: '', categoryId: null, accountId: 'local' },
    });
    expect(draftOf(null, [], TODAY, 'en-IE').draft.accountId).toBe('');
  });
});

describe('chipIds', () => {
  const more = FLEXIBLE_CATEGORIES.map((category) => category.id).filter((id) => !CORE_FLEXIBLE_IDS.includes(id));

  it('shows the six core categories, and the rest once More is open', () => {
    // In category order, as quick add's chips.
    const core = FLEXIBLE_CATEGORIES.map((category) => category.id).filter((id) => CORE_FLEXIBLE_IDS.includes(id));
    expect(chipIds(null, false)).toEqual(core);
    expect(core).toHaveLength(6);
    expect(chipIds(null, true)).toEqual([...chipIds(null, false), ...more]);
  });

  it('always shows the read category as a chip: one behind More while More is closed, or a fixed cost', () => {
    const [behindMore] = more;
    expect(chipIds(behindMore, false)).toEqual([...chipIds(null, false), behindMore]);
    expect(chipIds(behindMore, true)).toEqual(chipIds(null, true));
    expect(chipIds('phone', false)).toEqual([...chipIds(null, false), 'phone']);
    expect(chipIds('phone', true)).toEqual([...chipIds(null, false), 'phone', ...more]);
    expect(chipIds('food', false)).toEqual(chipIds(null, false));
  });
});
