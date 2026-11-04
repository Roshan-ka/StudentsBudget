'use client';

import { MoonIcon, SmartphoneIcon, SunIcon, type LucideIcon } from 'lucide-react';
import { cardVariants } from '@/components/ui/card';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { setThemeChoice, useThemeChoice } from '@/theme/store';
import { THEME_CHOICES, type ThemeChoice } from '@/theme/themes';

const ICONS: Record<ThemeChoice, LucideIcon> = { light: SunIcon, dark: MoonIcon, system: SmartphoneIcon };

/**
 * Settings → Appearance (redesign, chunk 9), right under Language: Light, Dark or Same as phone, as native radio
 * buttons in rows a thumb can hit. Rows, not three segments side by side, so "Comme le téléphone" fits at 375 px.
 * The chosen row is the yellow accent; the radio itself says which one is chosen, not the colour alone.
 */
export function AppearanceSection() {
  const { t } = useT();
  const choice = useThemeChoice();

  return (
    <section aria-labelledby="appearance-heading" className={cardVariants()}>
      <h3 id="appearance-heading" className="text-xl leading-tight font-extrabold">
        {t.theme.heading}
      </h3>
      <div role="radiogroup" aria-labelledby="appearance-heading" className="flex flex-col gap-2">
        {THEME_CHOICES.map((option) => {
          const Icon = ICONS[option];
          const chosen = option === choice;
          return (
            <label
              key={option}
              className={cn(
                'flex min-h-13 cursor-pointer items-center gap-3 rounded-md border-[1.5px] border-outline px-3.5 py-2 font-semibold',
                chosen ? 'bg-accent text-accent-foreground shadow-offset' : 'bg-card',
              )}
            >
              <input
                type="radio"
                name="theme"
                value={option}
                checked={chosen}
                onChange={() => setThemeChoice(option)}
                className="size-5 shrink-0 accent-primary"
              />
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              {t.theme.choices[option]}
            </label>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">{t.theme.hint}</p>
    </section>
  );
}
