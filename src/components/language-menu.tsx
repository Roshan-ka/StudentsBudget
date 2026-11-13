'use client';

import { Menu } from '@base-ui/react/menu';
import { CheckIcon, GlobeIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cardVariants } from '@/components/ui/card';
import { LANGUAGES, OFFERED, SELECTABLE, type Language } from '@/i18n/languages';
import { setLanguage } from '@/i18n/store';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';

/**
 * The language as a globe button that opens a small menu (the start page, 13-11-2026): each language in its own name,
 * the chosen one checked. The same choice as `LanguagePicker`, which stays the select in Settings and setup. Nothing
 * while there is only one language to pick.
 */
export function LanguageMenu() {
  const { t, lang } = useT();
  if (SELECTABLE.length < 2) return null;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={t.language.label}
        className="flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-outline bg-card text-card-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground"
      >
        <GlobeIcon aria-hidden="true" className="size-5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8} className="z-50 outline-none">
          <Menu.Popup className={cn(cardVariants(), 'min-w-44 gap-0 p-1.5 outline-none')}>
            <Menu.Group>
              <Menu.GroupLabel className="px-3 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground">
                {t.language.label}
              </Menu.GroupLabel>
              <Menu.RadioGroup
                value={lang}
                onValueChange={(value: unknown) => {
                  const picked = SELECTABLE.find((code) => code === value);
                  if (picked !== undefined) setLanguage(picked);
                }}
              >
                {SELECTABLE.map((code: Language) => (
                  <Menu.RadioItem
                    key={code}
                    value={code}
                    closeOnClick
                    lang={code}
                    className="flex min-h-11 cursor-default items-center justify-between gap-3 rounded-md px-3 text-sm outline-none select-none data-[checked]:bg-accent data-[checked]:font-semibold data-[checked]:text-accent-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground data-[checked]:data-[highlighted]:bg-accent"
                  >
                    {OFFERED.includes(code) ? LANGUAGES[code].name : t.language.draft(LANGUAGES[code].name)}
                    <Menu.RadioItemIndicator>
                      <CheckIcon aria-hidden="true" className="size-4" />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Where the header shows the globe: the start pages (the first screen, its sign-in and new-account forms) and setup. */
const START_PATHS = ['/start', '/start/sign-in', '/start/new-account', '/setup'];

/**
 * The globe at the end of the header, on the start pages and setup only (setup since 13-11-2026): anywhere else the
 * language lives in Settings.
 */
export function StartLanguageMenu() {
  const pathname = usePathname();
  return START_PATHS.includes(pathname) ? <LanguageMenu /> : null;
}
