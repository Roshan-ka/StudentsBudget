'use client';

import { ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';
import { legalFilledIn, OPERATOR } from '@/data/legal';
import { aiInBuild } from '@/features/ai/switch';
import { mapInBuild } from '@/features/discounts/map/map-flag';
import { remindersInBuild } from '@/features/reminder/reminder';
import { useT } from '@/i18n/use-t';
import { formatDate } from '@/lib/dates';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { LEGAL_WORDS, legalLangFor, sectionsFor, type LegalBlock } from './content';
import { IMPRESSUM_UPDATED, impressumSections } from './impressum';
import { PRIVACY_UPDATED, privacySections } from './privacy-notice';

const PAGES = {
  privacy: { sections: privacySections, updated: PRIVACY_UPDATED },
  impressum: { sections: impressumSections, updated: IMPRESSUM_UPDATED },
} as const;

const LINK = 'inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline underline-offset-4';

/**
 * Back to where the person came from: the page before in this tab, or the app when the page opened on its own (a link
 * from a note opens it in a new tab).
 */
function LegalBack() {
  const { t } = useT();
  return (
    <Link
      href="/"
      onClick={(event) => {
        if (window.history.length > 1) {
          event.preventDefault();
          window.history.back();
        }
      }}
      className={LINK}
    >
      <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:rotate-180" />
      {t.common.legal.back}
    </Link>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === 'p') return <p className="break-words">{block.text}</p>;
  if (block.kind === 'list') {
    return (
      <ul className="flex list-disc flex-col gap-1 ps-5">
        {block.items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="break-words">
      {block.lines.map((line, n) => (
        <span key={n} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}

/**
 * A legal page (legal pages, chunk 1): `/privacy` or `/impressum`. Its text is German on a German phone and English on
 * any other, with a line on a French or Spanish one; it is marked with its language. A build shows only the sections
 * it has the parts for. Each section's heading is its anchor, so a note can link to `/privacy#<id>`. While the
 * operator's details are placeholders, the page shows them as such (a Production build refuses to run then).
 */
export function LegalPage({ page }: { page: keyof typeof PAGES }) {
  const { t, lang } = useT();
  const legal = legalLangFor(lang);
  const { sections, updated } = PAGES[page];
  const shown = sectionsFor(sections(OPERATOR), {
    supabase: isSupabaseConfigured(),
    ai: aiInBuild(),
    reminder: remindersInBuild(),
    map: mapInBuild(),
  });
  const other = page === 'privacy' ? { href: '/impressum', text: t.common.legal.impressum } : { href: '/privacy', text: t.common.legal.privacy };

  return (
    <div className="flex flex-col gap-5">
      <LegalBack />
      <PageHeading id={page} />
      {legal.fallback && <p className="text-sm text-muted-foreground">{t.common.legal.onlyDeEn}</p>}
      <div lang={legal.lang} className="flex flex-col gap-6">
        {!legalFilledIn() && (
          <p className="rounded-lg bg-accent px-4 py-3 text-sm font-medium">{LEGAL_WORDS[legal.lang].draft}</p>
        )}
        {shown.map((section) => {
          const text = section[legal.lang];
          return (
            <section key={section.id} aria-labelledby={section.id} className="flex flex-col gap-2">
              <h3 id={section.id} className="scroll-mt-4 text-xl leading-snug font-extrabold break-words">
                {text.heading}
              </h3>
              {text.blocks.map((block, n) => (
                <Block key={n} block={block} />
              ))}
            </section>
          );
        })}
        <p className="text-sm text-muted-foreground">{LEGAL_WORDS[legal.lang].updated(formatDate(updated))}</p>
      </div>
      <Link href={other.href} className={LINK}>
        {other.text}
      </Link>
    </div>
  );
}

/** The two pages, as small links: on the start page, where the bottom navigation isn't yet. */
export function LegalLinks() {
  const { t } = useT();
  return (
    <nav aria-label={t.common.legal.label} className="flex flex-wrap gap-x-5">
      <Link href="/privacy" className={LINK}>
        {t.common.legal.privacy}
      </Link>
      <Link href="/impressum" className={LINK}>
        {t.common.legal.impressum}
      </Link>
    </nav>
  );
}
