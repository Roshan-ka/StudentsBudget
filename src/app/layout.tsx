import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppInit } from '@/components/app-init';
import { BottomNav } from '@/components/bottom-nav';
import { LanguageAttributes } from '@/components/language-attributes';
import { languageHeadScript } from '@/i18n/head-script';
import { DEFAULT_LANGUAGE, LANGUAGES, OFFERED, SELECTABLE } from '@/i18n/languages';
import './globals.css';

const geistSans = Geist({
  variable: '--font-sans',
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
  themeColor: '#0f766e',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  // Prerendered in the default language; the head script sets <html lang> and dir to this phone's before the first
  // paint, so <html> may differ from the HTML (suppressHydrationWarning, on <html> only).
  return (
    <html
      lang={DEFAULT_LANGUAGE}
      dir={LANGUAGES[DEFAULT_LANGUAGE].dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: languageHeadScript(OFFERED, SELECTABLE) }} />
      </head>
      <body className="flex min-h-full flex-col">
        <AppInit />
        <LanguageAttributes />
        <header className="bg-primary pt-[env(safe-area-inset-top)] text-primary-foreground">
          <h1 className="flex h-12 items-center px-4 text-lg font-semibold">StudentsBudget</h1>
        </header>
        <main className="flex-1 px-4 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom))] hyphens-auto">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
