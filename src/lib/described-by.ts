// What a field's `aria-describedby` points at (accessibility plan, chunk 6: docs/superpowers/plans/2026-11-05-accessibility.md):
// its hint, its currency and, while there is one, its error, so a screen reader reads them with the field.

/** The ids that apply, joined; undefined when none does, so React leaves the attribute out. */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  const list = ids.filter((id): id is string => typeof id === 'string' && id !== '');
  return list.length > 0 ? list.join(' ') : undefined;
}
