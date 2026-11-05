'use client';

import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';

/**
 * A page's heading in this phone's language. A client component, so a page that is prerendered (in the default
 * language) shows the phone's language right after the first render.
 */
export function PageHeading({ id, htmlId }: { id: keyof Messages['shell']['headings']; htmlId?: string }) {
  const { t } = useT();
  // The heading font from globals.css; balanced, and breaking a long German or French word rather than the layout.
  // `htmlId` names a page's one section by this heading (Settings' pages), so the two never repeat each other.
  return (
    <h2 id={htmlId} className="text-[28px] leading-tight font-extrabold text-balance break-words">
      {t.shell.headings[id]}
    </h2>
  );
}
