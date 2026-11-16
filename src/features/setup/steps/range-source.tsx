'use client';

import { ExternalLinkButton, FoldSummary } from '@/components/link-button';
import type { CityRange } from '@/data/cities';
import { contentLang } from '@/i18n/content';
import { useT } from '@/i18n/use-t';
import { formatDate } from '@/lib/dates';

/**
 * "studierendenwerke.de": enough to see where the link goes, short enough to fit a phone. An address the browser can't
 * read (a student's, in the moderation queue) shows as it is.
 */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
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
      {/* An outlined button with a chevron, as every fold-out (16-11-2026: buttons, never text links), at least 44 px
          high. The card colour under the foreground text, on the page or on a category's tint in setup's cards. */}
      <FoldSummary aria-label={label === undefined && about !== undefined ? t.common.source.of(about) : undefined}>
        {label ?? t.common.source.label}
      </FoldSummary>
      <div className="mt-2 flex flex-col gap-1">
        {/* The source's own text is city content; "Estimate" is the app's word. */}
        <p lang={estimate ? undefined : sourceLang} className="break-words">
          {estimate ? t.common.estimate : range.source}
        </p>
        <p>{t.common.source.checked(formatDate(range.checked))}</p>
        <ExternalLinkButton href={range.url} className="mt-1 break-all">
          {hostOf(range.url)}
        </ExternalLinkButton>
      </div>
    </details>
  );
}
