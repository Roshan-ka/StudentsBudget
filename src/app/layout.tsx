import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { BottomNav } from '@/components/bottom-nav';
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
  description: 'See where your money goes and log spending in seconds. Your data stays on your phone.',
  appleWebApp: { capable: true, title: 'StudentsBudget' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f766e',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="bg-primary pt-[env(safe-area-inset-top)] text-primary-foreground">
          <h1 className="flex h-12 items-center px-4 text-lg font-semibold">StudentsBudget</h1>
        </header>
        <main className="flex-1 px-4 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
