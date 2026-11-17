'use client';

import { ChevronDownIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useChoicePref } from '@/lib/phone-pref';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TIPS } from '@/data/tips';
import { categoryTint } from '@/features/charts/colors';
import { ChecklistView } from '@/features/checklist/checklist-view';
import { DiscountsView } from '@/features/discounts/discounts-view';
import { HacksView } from '@/features/hacks/hacks-view';
import { categoryNameIn } from '@/i18n/category-name';
import { tipIn } from '@/i18n/city';
import { useT } from '@/i18n/use-t';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { CategoryChip } from './category-chip';
import { CategoryPill } from './category-pill';
import { SourceLine } from './source-line';
import { sortTips, tipChipIds, tipTag } from './tips';

const SORTED = sortTips(TIPS);
const CHIPS = tipChipIds(TIPS);

const VIEWS = ['tips', 'discounts', 'hacks', 'checklist'] as const;
type View = (typeof VIEWS)[number];

/** The id of a tip's heading, which the checklist's "See the tip" scrolls to and focuses. */
const tipHeadingId = (tipId: string) => `tip-${tipId}`;

/**
 * The Tips tab: the Regensburg tips, the student discounts, students' own hacks (the hacks feed) or the checklist for
 * new students, one at a time. All stay mounted while another is shown, so each keeps its chosen category; `/tips`
 * stays the only route. The tips' category lives here, so the checklist's "See the tip" can show every tip at once.
 */
export function TipsView() {
  const { t } = useT();
  // Remembered on this phone (pain points, chunk 8): someone who reads the discounts opens on them.
  const [view, setView] = useChoicePref<View>('studentsbudget-tips-tab', VIEWS, 'tips');
  const [tipCategoryId, setTipCategoryId] = useState<string | null>(null);
  // A tip the checklist asked to see: shown with every category, then scrolled to and focused once it renders.
  const [seeTip, setSeeTip] = useState<string | null>(null);

  useEffect(() => {
    if (seeTip === null || view !== 'tips') return;
    const heading = document.getElementById(tipHeadingId(seeTip));
    heading?.scrollIntoView({ block: 'start' });
    heading?.focus();
  }, [seeTip, view]);

  return (
    <Tabs value={view} onValueChange={(value) => setView(VIEWS.find((known) => known === value) ?? 'tips')}>
      {/* Four tabs don't fit one row on a phone without breaking a word, so they make two rows of two there (Roshan,
          10-11-2026), and one row from the sm breakpoint. */}
      <TabsList aria-label={t.tips.tabsLabel} className="w-full flex-wrap">
        <TabsTrigger value="tips" className={HALF}>
          {t.tips.tips}
        </TabsTrigger>
        <TabsTrigger value="discounts" className={HALF}>
          {t.tips.discounts}
        </TabsTrigger>
        <TabsTrigger value="hacks" className={HALF}>
          {t.tips.hacks.tab}
        </TabsTrigger>
        <TabsTrigger value="checklist" className={HALF}>
          {t.tips.checklist.tab}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tips" keepMounted className="pt-2 text-base">
        <TipList categoryId={tipCategoryId} setCategoryId={setTipCategoryId} onSeen={() => setSeeTip(null)} />
      </TabsContent>
      <TabsContent value="discounts" keepMounted className="pt-2 text-base">
        <DiscountsView active={view === 'discounts'} />
      </TabsContent>
      <TabsContent value="hacks" keepMounted className="pt-2 text-base">
        <HacksView />
      </TabsContent>
      <TabsContent value="checklist" keepMounted className="pt-2 text-base">
        <ChecklistView
          onSeeTip={(tipId) => {
            setTipCategoryId(null);
            setSeeTip(tipId);
            setView('tips');
          }}
        />
      </TabsContent>
    </Tabs>
  );
}

/** A tab's width below the sm breakpoint: half the row, less half the list's gap. */
const HALF = 'max-sm:basis-[calc(50%-0.125rem)]';

/**
 * The Regensburg tips, all or one category at a time. The tips are static, so nothing here waits for the
 * database; the chosen category is kept only while the page stays mounted. A tip's own words come in the phone's
 * language where they are translated (`tipIn`), else in English, marked so.
 */
function TipList({
  categoryId,
  setCategoryId,
  onSeen,
}: {
  categoryId: string | null;
  setCategoryId: (id: string | null) => void;
  /** Leaving a tip's heading after "See the tip" took the focus there ends that visit. */
  onSeen: () => void;
}) {
  const { t, lang } = useT();
  const text = t.tips;
  const [showMore, setShowMore] = useState(false);
  const shown = categoryId === null ? SORTED : SORTED.filter((tip) => tip.categoryId === categoryId);

  const chip = (id: string | null, label: string) => (
    <CategoryChip
      key={id ?? 'all'}
      categoryId={id}
      label={label}
      pressed={categoryId === id}
      onPress={() => setCategoryId(id)}
    />
  );

  // Folding More away while one of its categories is chosen would leave a filter with no pressed chip.
  const toggleMore = () => {
    if (showMore && categoryId !== null && CHIPS.more.includes(categoryId)) setCategoryId(null);
    setShowMore(!showMore);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{text.tipsIntro}</p>
      <div role="group" aria-label={text.tipsFor} className="flex flex-wrap gap-2">
        {chip(null, text.all)}
        {CHIPS.main.map((id) => chip(id, categoryNameIn(t, id)))}
        {CHIPS.more.length > 0 && (
          <Button type="button" variant="chip" aria-expanded={showMore} onClick={toggleMore}>
            {text.more}
            <ChevronDownIcon aria-hidden="true" className={cn('transition-transform', showMore && 'rotate-180')} />
          </Button>
        )}
        {showMore && CHIPS.more.map((id) => chip(id, categoryNameIn(t, id)))}
      </div>
      <ul aria-label={text.tips} className="flex flex-col gap-3">
        {shown.map((tip) => {
          const words = tipIn(tip, lang);
          return (
            // Each card on its category's tint (group 2 redesign); its text keeps 4.5:1 there (`tokens.test.ts`).
            <li
              key={tip.id}
              className={cn(cardVariants(), 'gap-2')}
              style={{ backgroundColor: categoryTint(tip.categoryId) }}
            >
              {/* The category's icon and name on the card colour (review U7, 17-11-2026). */}
              <CategoryPill categoryId={tip.categoryId}>{tipTag(tip, lang)}</CategoryPill>
              <div lang={words.textLang} className="flex flex-col gap-1">
                <h3
                  id={tipHeadingId(tip.id)}
                  tabIndex={-1}
                  onBlur={onSeen}
                  className="scroll-mt-4 text-xl leading-snug font-extrabold outline-none"
                >
                  {words.title}
                </h3>
                <p className="text-sm text-muted-foreground">{words.body}</p>
              </div>
              <SourceLine
                url={words.url}
                source={words.source}
                sourceLang={words.textLang}
                after={t.common.source.checked(formatDate(words.checked))}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
