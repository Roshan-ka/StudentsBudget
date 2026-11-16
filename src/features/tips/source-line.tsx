'use client';

import { hostOf } from '@/features/setup/steps/range-source';
import { useT } from '@/i18n/use-t';

/**
 * Where a tip or a discount comes from, as one small muted line (group 2 redesign, Roshan, 16-11-2026: an exception to
 * the buttons rule, kept small): "Source: mensa.de · checked 04.11.2026". The host is the link, opened in a new tab;
 * the source's own words (city content, translated with the item) are its title, so they stay there on hover and for a
 * screen reader. `after` follows the link: the checked date, or for a student's discount who added it and when.
 */
export function SourceLine({
  url,
  source,
  sourceLang,
  after,
}: {
  url: string;
  /** The source's own words, or "Estimate"; a student's discount has none. */
  source?: string;
  /** The language of `source` where it isn't the phone's (`textLang`). */
  sourceLang?: 'en' | undefined;
  after: string;
}) {
  const { t } = useT();
  const estimate = source === 'Estimate';
  return (
    <p className="text-xs break-words text-muted-foreground">
      {t.tips.sourceLead}{' '}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={estimate ? t.common.estimate : source}
        lang={estimate || source === undefined ? undefined : sourceLang}
        className="break-all underline underline-offset-2"
      >
        {hostOf(url)}
      </a>
      {after !== '' && ` · ${after}`}
    </p>
  );
}
