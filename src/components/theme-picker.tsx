'use client';

import { CircleCheckIcon, MoonIcon, SmartphoneIcon, SunIcon, type LucideIcon } from 'lucide-react';
import { cardVariants } from '@/components/ui/card';
import { categoryTint } from '@/features/charts/colors';
import { RowTile } from '@/features/home/row-card';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { setThemeChoice, useThemeChoice } from '@/theme/store';
import { THEME_CHOICES, type ThemeChoice } from '@/theme/themes';

/** Each choice's tile: the sun on yellow, the moon on blue, the phone on green (Roshan's mockups, 17-11-2026). */
const TILES: Record<ThemeChoice, { icon: LucideIcon; tint: string }> = {
  light: { icon: SunIcon, tint: categoryTint('insurance') },
  dark: { icon: MoonIcon, tint: categoryTint('rent') },
  system: { icon: SmartphoneIcon, tint: categoryTint('eating-out') },
};

/**
 * Settings → Appearance (redesign, chunk 9; group 4 redesign, 17-11-2026): Light, Dark or Same as phone, a card each
 * with its tinted tile, one under the other so "Comme le téléphone" fits at 375 px. Still a native radio group: each
 * card is the label of a radio that covers it, unseen, so a tap anywhere on the card chooses it and the radio keeps its
 * name and state. The chosen card says so twice, never by colour alone: a heavier outline and a check icon.
 */
export function AppearanceSection() {
  const { t } = useT();
  const choice = useThemeChoice();

  return (
    // Named by its page's heading (/settings/appearance), which has the id.
    <section aria-labelledby="appearance-heading" className="flex flex-col gap-3">
      <div role="radiogroup" aria-labelledby="appearance-heading" className="flex flex-col gap-3">
        {THEME_CHOICES.map((option) => {
          const tile = TILES[option];
          const chosen = option === choice;
          return (
            <label
              key={option}
              className={cn(
                cardVariants(),
                'relative min-h-14 cursor-pointer flex-row items-center gap-3 px-4 py-3 font-semibold',
                'has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring',
                chosen ? 'border-[3px]' : 'border-[1.5px]',
              )}
            >
              <input
                type="radio"
                name="theme"
                value={option}
                checked={chosen}
                onChange={() => setThemeChoice(option)}
                className="absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-lg opacity-0"
              />
              <RowTile icon={tile.icon} tint={tile.tint} />
              <span className="min-w-0 flex-1 break-words">{t.theme.choices[option]}</span>
              {chosen && <CircleCheckIcon aria-hidden="true" className="size-6 shrink-0" />}
            </label>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">{t.theme.hint}</p>
    </section>
  );
}
