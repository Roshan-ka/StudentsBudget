// Links out of the model's text (the AI phase, chunks 8 and 11, docs/superpowers/plans/2026-11-09-ai-phase-1.md): the
// app shows links only from its own data, never one the model wrote. A link ends before a closing bracket and before
// the punctuation that ends its sentence, so "(see https://example.com)." keeps its ")." and reads "(see )."

const LINK = /\b(?:https?:\/\/|www\.)[^\s)\]>]*[^\s)\]>.,;:!?'"]/gi;

/** The text without links, its spaces tidied. */
export function withoutLinks(text: string): string {
  return text
    .replace(LINK, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim();
}
