import { describe, expect, it } from 'vitest';
import { noticeClass } from './notice';

describe('noticeClass (review U7, 17-11-2026)', () => {
  it('is the muted box by default, and the accent one when asked', () => {
    expect(noticeClass().split(' ')).toEqual(expect.arrayContaining(['rounded-lg', 'px-4', 'py-3', 'bg-muted']));
    expect(noticeClass('accent').split(' ')).toContain('bg-accent');
    expect(noticeClass('accent').split(' ')).not.toContain('bg-muted');
  });

  it('adds the box’s own layout and text', () => {
    expect(noticeClass('muted', 'flex flex-col gap-3').split(' ')).toEqual(
      expect.arrayContaining(['flex', 'flex-col', 'gap-3', 'bg-muted']),
    );
  });
});
