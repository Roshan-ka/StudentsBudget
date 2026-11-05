'use client';

import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { usePageTitle } from '@/lib/page-title';
import { cn } from '@/lib/utils';

/**
 * A page's heading in this phone's language. A client component, so a page that is prerendered (in the default
 * language) shows the phone's language right after the first render. It names the page in the browser's title, and
 * `RouteFocus` moves the focus to it after a page change (`data-page-heading`, focusable from script only).
 */
export function PageHeading({
  id,
  htmlId,
  visuallyHidden = false,
}: {
  id: keyof Messages['shell']['headings'];
  htmlId?: string;
  /** For a page whose content says what it is (Home), the heading is there for screen readers and the title. */
  visuallyHidden?: boolean;
}) {
  const { t } = useT();
  const text = t.shell.headings[id];
  usePageTitle(text);
  // The heading font from globals.css; balanced, and breaking a long German or French word rather than the layout.
  // `htmlId` names a page's one section by this heading (Settings' pages), so the two never repeat each other.
  return (
    <h2
      id={htmlId}
      data-page-heading
      tabIndex={-1}
      className={cn(
        'text-[28px] leading-tight font-extrabold text-balance break-words outline-none',
        visuallyHidden && 'sr-only',
      )}
    >
      {text}
    </h2>
  );
}
