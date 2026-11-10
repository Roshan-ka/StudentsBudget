import { describe, expect, it } from 'vitest';
import { CHECKLIST, CHECKLIST_GROUPS, CHECKLIST_WHO } from './checklist';
import { TIPS } from './tips';

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

describe('the checklist for new students', () => {
  it('every item has a title, a body, a group, who it is for, a source, a url and a checked date', () => {
    expect(CHECKLIST.length).toBeGreaterThan(0);
    for (const item of CHECKLIST) {
      expect(item.id, 'id').toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(item.title.trim(), `${item.id} title`).not.toBe('');
      expect(item.body.trim(), `${item.id} body`).not.toBe('');
      expect(CHECKLIST_GROUPS, `${item.id} group`).toContain(item.group);
      expect(CHECKLIST_WHO, `${item.id} who`).toContain(item.who);
      expect(item.source.trim(), `${item.id} source`).not.toBe('');
      expect(item.url, `${item.id} url`).toMatch(/^https:\/\/\S+$/);
      expect(isRealIsoDate(item.checked), `${item.id} checked`).toBe(true);
    }
  });

  it('has unique ids, and items in both groups', () => {
    const ids = CHECKLIST.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const group of CHECKLIST_GROUPS) expect(CHECKLIST.some((item) => item.group === group), group).toBe(true);
  });

  it('links only to tips that exist', () => {
    const tipIds = new Set(TIPS.map((tip) => tip.id));
    for (const item of CHECKLIST) {
      if (item.tipId !== undefined) expect(tipIds.has(item.tipId), `${item.id} tip ${item.tipId}`).toBe(true);
    }
  });
});
