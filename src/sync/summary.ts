/** "1 entry", "42 entries". */
export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "a", "a and b", "a, b and c". */
export function listed(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** What a set of data holds, in words: "3 accounts, 42 entries and your plan". */
export function contentsOf(accounts: number, entries: number, hasPlan: boolean): string {
  const parts = [count(accounts, 'account', 'accounts'), count(entries, 'entry', 'entries')];
  if (hasPlan) parts.push('your plan');
  return listed(parts);
}
