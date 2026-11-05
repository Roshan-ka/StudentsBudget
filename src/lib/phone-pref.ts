// Small choices this phone remembers (pain points, docs/superpowers/plans/2026-11-05-pain-points.md), in localStorage
// like the language and the theme: per phone, never synced, never backed up. Storage that can't be read (a private
// window) or written is no error: the app falls back to its default.

/** The stored value, or null when there is none or storage can't be read. */
export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Stores `value`; a phone whose storage refuses it keeps its default next time. */
export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do: remembering is a convenience.
  }
}
