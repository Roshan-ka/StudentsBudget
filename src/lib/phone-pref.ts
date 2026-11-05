import { useSyncExternalStore } from 'react';

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

const listeners = new Set<() => void>();

/** Stores `value` and tells the components reading it; a phone whose storage refuses it keeps its default next time. */
export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do: remembering is a convenience.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * One of `allowed`, as this phone last chose it, and the way to choose: `fallback` on the server and in the first
 * render (so prerendered pages hydrate as they were built), the stored choice right after, and `fallback` for a value
 * this build doesn't know. Pain points, chunk 8.
 */
export function useChoicePref<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => readPref(key),
    () => null,
  );
  const value = allowed.find((option) => option === stored) ?? fallback;
  return [value, (next: T) => writePref(key, next)];
}
