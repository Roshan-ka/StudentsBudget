'use client';

import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { useChoicePref } from '@/lib/phone-pref';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TIPS } from '@/data/tips';
import { categoryTint } from '@/features/charts/colors';
import { DiscountsView } from '@/features/discounts/discounts-view';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import { HacksView } from '@/features/hacks/hacks-view';
import { RangeSource } from '@/features/setup/steps/range-source';
import { categoryNameIn } from '@/i18n/category-name';
import { tipIn } from '@/i18n/city';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { sortTips, tipChipIds, tipTag } from './tips';

const SORTED = sortTips(TIPS);
const CHIPS = tipChipIds(TIPS);

const VIEWS = ['tips', 'discounts', 'hacks'] as const;
type View = (typeof VIEWS)[number];

/**
 * The Tips tab: the Regensburg tips, the student discounts or students' own hacks (the hacks feed), one at a time.
 * All stay mounted while another is shown, so each keeps its chosen category; `/tips` stays the only route.
 */
export function TipsView() {
  const { t } = useT();
  // Remembered on this phone (pain points, chunk 8): someone who reads the discounts opens on them.
  const [view, setView] = useChoicePref<View>('studentsbudget-tips-tab', VIEWS, 'tips');

  return (
    <Tabs value={view} onValueChange={(value) => setView(VIEWS.find((known) => known === value) ?? 'tips')}>
      <TabsList aria-label={t.tips.tabsLabel} className="w-full">
        <TabsTrigger value="tips">{t.tips.tips}</TabsTrigger>
        <TabsTrigger value="discounts">{t.tips.discounts}</TabsTrigger>
        <TabsTrigger value="hacks">{t.tips.hacks.tab}</TabsTrigger>
      </TabsList>
      <TabsContent value="tips" keepMounted className="pt-2 text-base">
        <TipList />
      </TabsContent>
      <TabsContent value="discounts" keepMounted className="pt-2 text-base">
        <DiscountsView />
      </TabsContent>
      <TabsContent value="hacks" keepMounted className="pt-2 text-base">
        <HacksView />
      </TabsContent>
    </Tabs>
  );
}

/**
 * The Regensburg tips, all or one category at a time. The tips are static, so nothing here waits for the
 * database; the chosen category is kept only while the page stays mounted. A tip's own words come in the phone's
 * language where they are translated (`tipIn`), else in English, marked so.
 */
function TipList() {
  const { t, lang } = useT();
  const text = t.tips;
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const shown = categoryId === null ? SORTED : SORTED.filter((tip) => tip.categoryId === categoryId);

  const chip = (id: string | null, label: string) => (
    <Button
      key={id ?? 'all'}
      type="button"
      variant="chip"
      aria-pressed={categoryId === id}
      onClick={() => setCategoryId(id)}
    >
      {label}
    </Button>
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
          const Icon = CATEGORY_ICONS[tip.categoryId] ?? OTHER_ICON;
          return (
            <li key={tip.id} className={cn(cardVariants(), 'gap-2 pb-0')}>
              {/* The category's tint and icon; its name is the text, in the foreground colour (4.5:1 on every tint). */}
              <span
                className="inline-flex w-fit items-center gap-1.5 rounded-full border-[1.5px] border-outline px-2.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: categoryTint(tip.categoryId) }}
              >
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                {tipTag(tip, lang)}
              </span>
              <div lang={words.textLang} className="flex flex-col gap-1">
                <h3 className="text-xl leading-snug font-extrabold">{words.title}</h3>
                <p className="text-sm text-muted-foreground">{words.body}</p>
              </div>
              <RangeSource range={words} about={words.title} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
