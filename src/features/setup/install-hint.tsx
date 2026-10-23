'use client';

import { useSyncExternalStore } from 'react';
import { shouldShowInstallHint } from './draft';

function detectEnvironment(): { isIos: boolean; standalone: boolean } {
  const iPhoneOrIPad = /iPhone|iPad|iPod/.test(navigator.userAgent);
  // iPadOS 13+ reports itself as a Mac, with a touch screen.
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return { isIos: iPhoneOrIPad || iPadOs, standalone };
}

// The environment does not change while the page is open.
const subscribe = () => () => {};
const showOnClient = () => shouldShowInstallHint(detectEnvironment());
const showOnServer = () => false;

/** True in iOS Safari outside the home-screen app, which keeps its own storage and sign-ins apart from Safari's. */
export function useShowInstallHint(): boolean {
  // The server snapshot is used for the server render and for hydration, so they always agree; the
  // browser's own answer replaces it right after. An effect with setState would do the same but lints as a cascading render.
  return useSyncExternalStore(subscribe, showOnClient, showOnServer);
}

/** Tells iOS Safari users to install first: Safari and the home-screen app keep separate storage. */
export function InstallHint() {
  const show = useShowInstallHint();

  if (!show) return null;
  return (
    <p className="rounded-lg bg-muted px-4 py-3 text-sm">
      Install first: tap Share → Add to Home Screen, then set up there. Data entered in Safari stays in Safari.
    </p>
  );
}
