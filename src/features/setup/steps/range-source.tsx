'use client';

import type { CityRange } from '@/data/cities';
import { SourceLine } from '@/features/tips/source-line';
import { contentLang } from '@/i18n/content';
import { useT } from '@/i18n/use-t';
import { formatDate } from '@/lib/dates';

/**
 * Where a city range (or any sourced figure) comes from, in Tips' one small line (Roshan, 16-11-2026: "the source
 * button should follow the tips page format everywhere"): "Source: uni-regensburg.de · checked 16.10.2026", the
 * source's own words on the link's title, and an estimate saying so in the line. `covers` says what the line is about
 * where a block has several sources ("Source for €3.80: bahn.de · …"), and `listed` starts the line with the item in a
 * list of sources that has its own heading ("Eating out: stwno.de · …"); `about` names the item in the link's name
 * where a page has several lines that would otherwise read alike ("stwno.de, Eating out"; accessibility, chunk 8).
 * An item from `src/i18n/city` brings its `textLang`; anything else is still English in another language
 * (`contentLang`).
 */
export function RangeSource({
  range,
  covers,
  listed,
  about,
}: {
  range: Pick<CityRange, 'source' | 'url' | 'checked'> & { textLang?: 'en' | undefined };
  covers?: string;
  listed?: string;
  about?: string;
}) {
  const { t, lang } = useT();
  const sourceLang = 'textLang' in range ? range.textLang : contentLang(lang);
  return (
    <SourceLine
      url={range.url}
      source={range.source}
      sourceLang={sourceLang}
      lead={
        listed !== undefined
          ? t.common.source.listed(listed)
          : covers !== undefined
            ? t.common.source.for(covers)
            : undefined
      }
      about={about ?? listed ?? covers}
      after={t.common.source.checked(formatDate(range.checked))}
    />
  );
}
