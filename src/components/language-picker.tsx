'use client';

import { useId } from 'react';
import { cardVariants } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { LANGUAGES, OFFERED, SELECTABLE, type Language } from '@/i18n/languages';
import { setLanguage } from '@/i18n/store';
import { useT } from '@/i18n/use-t';

/**
 * The language this phone shows, picked from the ones this build lists (`SELECTABLE`): each by its own name, in its
 * own language, so someone who can't read the current one still finds theirs. A draft a dev build lists says so.
 * Nothing while there is only one to pick. `hint` adds the line on what the choice changes.
 */
export function LanguagePicker({ hint = false }: { hint?: boolean }) {
  const id = useId();
  const { t, lang } = useT();
  if (SELECTABLE.length < 2) return null;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{t.language.label}</Label>
      <NativeSelect
        id={id}
        className="w-full"
        value={lang}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => {
          const picked = SELECTABLE.find((code) => code === event.target.value);
          if (picked !== undefined) setLanguage(picked);
        }}
      >
        {SELECTABLE.map((code: Language) => (
          <NativeSelectOption key={code} value={code} lang={code}>
            {OFFERED.includes(code) ? LANGUAGES[code].name : t.language.draft(LANGUAGES[code].name)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {t.language.hint}
        </p>
      )}
    </div>
  );
}

/** Settings → Language, at the top: the picker and what it changes. Nothing while there is only one language. */
export function LanguageSection() {
  const { t } = useT();
  if (SELECTABLE.length < 2) return null;
  return (
    <section aria-labelledby="language-heading" className={cardVariants()}>
      <h3 id="language-heading" className="text-xl leading-tight font-extrabold">
        {t.language.heading}
      </h3>
      <LanguagePicker hint />
    </section>
  );
}
