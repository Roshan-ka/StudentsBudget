import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import {
  checkDraft,
  draftOf,
  normaliseUsername,
  parseBatch,
  postingNameText,
  RESERVED_USERNAMES,
  USERNAME_MAX,
  USERNAME_MIN,
  usernameProblem,
} from './posting-name';

describe('the username', () => {
  it('is saved without spaces around it or a leading @, in lower case', () => {
    expect(normaliseUsername('  @Roshan_27 ')).toBe('roshan_27');
  });

  it('says what is wrong, in the order the database would refuse it', () => {
    expect(usernameProblem('')).toBe('empty');
    expect(usernameProblem('ro shan')).toBe('characters');
    expect(usernameProblem('ro-shan')).toBe('characters');
    expect(usernameProblem('rö')).toBe('characters');
    expect(usernameProblem('ro')).toBe('short');
    expect(usernameProblem('a'.repeat(21))).toBe('long');
    expect(usernameProblem('moderator')).toBe('reserved');
    expect(usernameProblem('roshan_27')).toBeNull();
    expect(usernameProblem('a'.repeat(20))).toBeNull();
  });

  it('follows the database’s rule, written in the migration as well', () => {
    const sql = readFileSync('supabase/migrations/20261105100426_public_profiles.sql', 'utf8');
    const pattern = `'^[a-z0-9_]{${USERNAME_MIN},${USERNAME_MAX}}$'`;
    // Once in the table's check, once in username_available.
    expect(sql.split(pattern).length - 1).toBe(2);
    const reserved = `not in (${RESERVED_USERNAMES.map((name) => `'${name}'`).join(', ')})`;
    expect(sql.split(reserved).length - 1).toBe(2);
  });
});

describe('the batch year', () => {
  it('is optional, and otherwise a year from 2000 to 2100', () => {
    expect(parseBatch('')).toBeNull();
    expect(parseBatch(' 2027 ')).toBe(2027);
    expect(parseBatch('27')).toBe('invalid');
    expect(parseBatch('1999')).toBe('invalid');
    expect(parseBatch('2101')).toBe('invalid');
    expect(parseBatch('20x7')).toBe('invalid');
  });
});

describe('the fields', () => {
  it('give the name to save, or the first problem', () => {
    expect(checkDraft({ username: '@Dana', label: 'alumni', batch: '' })).toEqual({
      ok: true,
      name: { username: 'dana', label: 'alumni', batch: null },
    });
    expect(checkDraft({ username: 'da', label: 'student', batch: '27' })).toEqual({ ok: false, problem: 'short' });
    expect(checkDraft({ username: 'dana', label: 'student', batch: '27' })).toEqual({ ok: false, problem: 'batch' });
  });

  it('fill from a saved name, a missing label as Student', () => {
    expect(draftOf({ username: 'dana', label: null, batch: 2026 })).toEqual({
      username: 'dana',
      label: 'student',
      batch: '2026',
    });
  });
});

describe('how others see the name', () => {
  const text = MESSAGES.en.auth.postingName;

  it('joins the username, the label and the batch', () => {
    expect(postingNameText({ username: 'roshan', label: 'student', batch: 2027 }, text)).toBe("@roshan · Student · Batch '27");
    expect(postingNameText({ username: 'dana', label: null, batch: null }, text)).toBe('@dana');
  });
});
