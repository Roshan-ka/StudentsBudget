'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TIPS } from '@/data/tips';
import { DiscountsView } from '@/features/discounts/discounts-view';
import { RangeSource } from '@/features/setup/steps/range-source';
import { categoryNameIn } from '@/i18n/category-name';
import { tipIn } from '@/i18n/city';
import { useT } from '@/i18n/use-t';
import { sortTips, tipChipIds, tipTag } from './tips';

const SORTED = sortTips(TIPS);
const CHIPS = tipChipIds(TIPS);

type View = 'tips' | 'discounts';

/**
 * The Tips tab: the Regensburg tips or the student discounts, one at a time. Both stay mounted while the other is
 * shown, so each keeps its chosen category; `/tips` stays the only route.
 */
export function TipsView() {
  const { t } = useT();
  const [view, setView] = useState<View>('tips');

  return (
    <Tabs value={view} onValueChange={(value) => setView(value === 'discounts' ? 'discounts' : 'tips')}>
      <TabsList aria-label={t.tips.tabsLabel} className="w-full">
        <TabsTrigger value="tips">{t.tips.tips}</TabsTrigger>
        <TabsTrigger value="discounts">{t.tips.discounts}</TabsTrigger>
      </TabsList>
      <TabsContent value="tips" keepMounted className="pt-2 text-base">
        <TipList />
      </TabsContent>
      <TabsContent value="discounts" keepMounted className="pt-2 text-base">
        <DiscountsView />
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
      variant={categoryId === id ? 'default' : 'outline'}
      aria-pressed={categoryId === id}
      className="px-3"
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
          <Button type="button" variant="secondary" className="px-3" aria-expanded={showMore} onClick={toggleMore}>
            {text.more}
          </Button>
        )}
        {showMore && CHIPS.more.map((id) => chip(id, categoryNameIn(t, id)))}
      </div>
      <ul aria-label={text.tips} className="flex flex-col gap-3">
        {shown.map((tip) => {
          const words = tipIn(tip, lang);
          return (
            <li key={tip.id} className="flex flex-col gap-2 rounded-lg border px-4 py-3">
              <div lang={words.textLang} className="flex flex-col gap-1">
                <h3 className="font-medium">{words.title}</h3>
                <p className="text-sm text-muted-foreground">{words.body}</p>
              </div>
              {/* An outline, not the muted fill: muted text on the muted fill is about 4.3:1, on the page about 4.7:1. */}
              <span className="w-fit rounded-md border px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {tipTag(tip, lang)}
              </span>
              <RangeSource range={words} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
