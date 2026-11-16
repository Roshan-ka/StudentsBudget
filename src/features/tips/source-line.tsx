'use client';

import { useT } from '@/i18n/use-t';

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
 * Where something comes from, as one small muted line (group 2 redesign, Roshan, 16-11-2026: an exception to the
 * buttons rule, kept small; every source in the app since, setup's included): "Source: mensa.de · checked 04.11.2026".
 * The host is the link, opened in a new tab; the source's own words (city content, translated with the item) are its
 * title, so they stay there on hover and for a screen reader. An estimate says so in the line, before the link
 * ("Source: Estimate · stwno.de · …"). `lead` replaces "Source:" where a line says what it covers ("Source for
 * €3.80:"); `about` names the item in the link's name after the host ("stwno.de, Eating out"), so a page with several
 * keeps them apart and the visible host still starts the name. `after` follows the link: the checked date, or for a
 * student's discount who added it and when.
 */
export function SourceLine({
  url,
  source,
  sourceLang,
  after,
  lead,
  about,
}: {
  url: string;
  /** The source's own words, or "Estimate"; a student's discount has none. */
  source?: string;
  /** The language of `source` where it isn't the phone's (`textLang`). */
  sourceLang?: 'en' | undefined;
  after: string;
  /** The words before the link; "Source:" in the phone's language without it. */
  lead?: string;
  /** What the line is about, for the link's name where a page has several. */
  about?: string;
}) {
  const { t } = useT();
  const estimate = source === 'Estimate';
  const host = hostOf(url);
  return (
    <p className="text-xs break-words text-muted-foreground">
      {lead ?? t.tips.sourceLead} {estimate && `${t.common.estimate} · `}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={estimate ? t.common.estimate : source}
        aria-label={about === undefined ? undefined : `${host}, ${about}`}
        lang={estimate || source === undefined ? undefined : sourceLang}
        className="break-all underline underline-offset-2"
      >
        {host}
      </a>
      {after !== '' && ` · ${after}`}
    </p>
  );
}
