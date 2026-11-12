'use client';

import { useSyncExternalStore } from 'react';
import { canDrawMap } from './load-maplibre';
import type { MapFlavor } from './style';

// What every map of the app reads from the page (discount map): the theme it draws in and whether it can draw at all.
// `DiscountMap` keeps its own copies of these from chunk 4; the form's picker (chunk 8) reads them from here.

/** The app's theme as the page shows it: the `dark` class `ThemeAttributes` keeps on <html>. */
function subscribeToTheme(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** The flavour a map draws in now. */
export const flavorNow = (): MapFlavor => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
const flavorOnServer = (): MapFlavor => 'light';

/** The flavour, following the theme. */
export function useMapFlavor(): MapFlavor {
  return useSyncExternalStore(subscribeToTheme, flavorNow, flavorOnServer);
}

/** Whether WebGL 2 is there never changes while the page is open. */
const neverChanges = () => () => {};
const drawableOnServer = () => true;

/** Whether this browser can draw a map (MapLibre needs WebGL 2). */
export function useCanDrawMap(): boolean {
  return useSyncExternalStore(neverChanges, canDrawMap, drawableOnServer);
}

/** Whether the person asked for less motion: the map then jumps instead of gliding. */
export function prefersLessMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
