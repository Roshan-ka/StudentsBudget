import { WalletIcon } from 'lucide-react';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans, Geist_Mono } from 'next/font/google';
import { AppInit } from '@/components/app-init';
import { BottomNav } from '@/components/bottom-nav';
import { LanguageAttributes } from '@/components/language-attributes';
import { ThemeAttributes } from '@/components/theme-attributes';
import { languageHeadScript } from '@/i18n/head-script';
import { DEFAULT_LANGUAGE, LANGUAGES, OFFERED, SELECTABLE } from '@/i18n/languages';
import { themeHeadScript } from '@/theme/themes';
import './globals.css';

// Self-hosted at build time, so they come from /_next/static and the service worker keeps them for offline. `latin`
// covers German, French and Spanish, the narrow no-break space and €.
const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
});

/** Headings and big numbers. */
const bricolage = Bricolage_Grotesque({
  variable: '--font-heading',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'StudentsBudget',
  description: 'See where your money goes and log spending in seconds. Your data stays on your phone unless you link it to your account.',
  appleWebApp: { capable: true, title: 'StudentsBudget' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // The page colour (`--background`), so the status bar runs into the page.
  themeColor: '#fbf6ec',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  // Prerendered in the default language; the head script sets <html lang> and dir to this phone's before the first
  // paint, so <html> may differ from the HTML (suppressHydrationWarning, on <html> only).
  return (
    <html
      lang={DEFAULT_LANGUAGE}
      dir={LANGUAGES[DEFAULT_LANGUAGE].dir}
      // scroll-padding-bottom: the browser scrolls a focused control above the bottom nav, never behind it (WCAG 2.2,
      // Focus Not Obscured).
      className={`${dmSans.variable} ${bricolage.variable} ${geistMono.variable} h-full scroll-pb-[calc(5rem+env(safe-area-inset-bottom))] antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: languageHeadScript(OFFERED, SELECTABLE) }} />
        {/* Prerendered light; a phone set to dark gets the dark class before the first paint (also suppressed above). */}
        <script dangerouslySetInnerHTML={{ __html: themeHeadScript() }} />
      </head>
      <body className="flex min-h-full flex-col">
        <AppInit />
        <LanguageAttributes />
        <ThemeAttributes />
        {/* The wordmark on the page itself, no coloured bar. The dot is decoration: the heading's name stays
            "StudentsBudget", which smoke.spec.ts and offline.spec.ts look for. With text at 200 % the name is wider
            than the phone, so it may break before "Budget" (<wbr> adds no text to the name). */}
        <header className="pt-[env(safe-area-inset-top)]">
          <h1 className="flex min-h-14 items-center gap-2 px-4 text-lg font-extrabold">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-outline bg-highlight"
            >
              <WalletIcon className="size-4" />
            </span>
            <span className="min-w-0">
              Students
              <wbr />
              Budget
            </span>
          </h1>
        </header>
        {/* The bottom padding clears the nav (at least 4 rem and its outline) with room to spare. */}
        <main className="flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] hyphens-auto">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
