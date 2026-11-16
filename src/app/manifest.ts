import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StudentsBudget',
    short_name: 'StudentsBudget',
    description: 'See where your money goes and log spending in seconds. Your data stays on your phone unless you link it to your account.',
    start_url: '/',
    display: 'standalone',
    // The page colour (`--background` in globals.css), for the splash screen and the status bar.
    background_color: '#fbf6ec',
    theme_color: '#fbf6ec',
    // The same two files serve both purposes: scripts/icon/icon.svg draws everything inside the maskable safe zone (the
    // central 80 %) on the page colour, so a launcher may crop it to its own shape. manifest.test.ts holds that.
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
