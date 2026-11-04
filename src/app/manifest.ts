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
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
