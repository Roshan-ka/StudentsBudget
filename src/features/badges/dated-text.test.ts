import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DatedText } from './dated-text';

const html = (text: string) => renderToStaticMarkup(createElement(DatedText, { text }));

describe('DatedText', () => {
  it('keeps each full date on one line and the text as it was', () => {
    expect(html('Bronze · earned 15-11-2026')).toBe(
      'Bronze · earned <span class="whitespace-nowrap">15-11-2026</span>',
    );
    expect(html('Cheapest grocery week so far: €30 (week of 26-10-2026). A cheaper week earns it')).toBe(
      'Cheapest grocery week so far: €30 (week of <span class="whitespace-nowrap">26-10-2026</span>). A cheaper week earns it',
    );
    expect(html('From 02-11-2026 to 08-11-2026')).toBe(
      'From <span class="whitespace-nowrap">02-11-2026</span> to <span class="whitespace-nowrap">08-11-2026</span>',
    );
  });

  it('leaves text without a full date alone', () => {
    expect(html('4 of 12 weeks')).toBe('4 of 12 weeks');
    expect(html('Your streak is paused at 5 weeks')).toBe('Your streak is paused at 5 weeks');
    // A month or a year alone is not a full date.
    expect(html('November 2026: €40 on eating out')).toBe('November 2026: €40 on eating out');
  });
});
