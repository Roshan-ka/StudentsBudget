'use client';

import type { CityRange } from '@/data/cities';
import { contentLang } from '@/i18n/content';
import { useT } from '@/i18n/use-t';
import { formatDate } from '@/lib/dates';

/** "studierendenwerke.de": enough to see where the link goes, short enough to fit a phone. */
function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

/**
 * Where a city range comes from, collapsed under the range line: source text, check date and link. `label` is the
 * words on the collapsed line ("Source" in the phone's language without it); a swap with two amounts has two sources,
 * which it tells apart by what each one covers. An item from `src/i18n/city` brings its `textLang`; anything else is
 * still English in another language (`contentLang`). `about` names the item for a screen reader when the words on
 * the line are just "Source" and a page has several ("Source: Eating out"; accessibility, chunk 8).
 */
export function RangeSource({
  range,
  label,
  about,
}: {
  range: Pick<CityRange, 'source' | 'url' | 'checked'> & { textLang?: 'en' | undefined };
  label?: string;
  about?: string;
}) {
  const { t, lang } = useT();
  const estimate = range.source === 'Estimate';
  const sourceLang = 'textLang' in range ? range.textLang : contentLang(lang);
  return (
    <details className="text-xs text-muted-foreground">
      {/* A line and 28 px of padding: at least a 44 px tap target, as everywhere else in the app. Bold cobalt and
          underlined, so it reads as something to open; it sits on the card colour, where cobalt is 6.9:1. */}
      <summary
        aria-label={label === undefined && about !== undefined ? t.common.source.of(about) : undefined}
        className="w-fit cursor-pointer py-3.5 text-[13px] font-semibold text-primary underline underline-offset-4"
      >
        {label ?? t.common.source.label}
      </summary>
      {/* Space below: a card ends flush with the closed summary, which is tall enough on its own. */}
      <div className="mb-3.5 flex flex-col gap-1">
        {/* The source's own text is city content; "Estimate" is the app's word. */}
        <p lang={estimate ? undefined : sourceLang} className="break-words">
          {estimate ? t.common.estimate : range.source}
        </p>
        <p>{t.common.source.checked(formatDate(range.checked))}</p>
        <a href={range.url} target="_blank" rel="noopener noreferrer" className="w-fit break-all underline">
          {hostOf(range.url)}
        </a>
      </div>
    </details>
  );
}
