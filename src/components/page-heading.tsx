'use client';

import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';

/**
 * A page's heading in this phone's language. A client component, so a page that is prerendered (in the default
 * language) shows the phone's language right after the first render.
 */
export function PageHeading({ id }: { id: keyof Messages['shell']['headings'] }) {
  const { t } = useT();
  return <h2 className="text-lg font-semibold">{t.shell.headings[id]}</h2>;
}
