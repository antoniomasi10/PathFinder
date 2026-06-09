'use client';

import { Sora, DM_Sans, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import QueryProvider from '@/components/QueryProvider';
import { LanguageProvider } from '@/lib/language';
import { PrivacyProvider } from '@/lib/privacy';
import CookieBanner from '@/components/CookieBanner';
import AnalyticsProvider from '@/components/AnalyticsProvider';
import Script from 'next/script';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <head>
        <title>COhA — University is not enough</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
        <meta name="theme-color" content="#4F46E5" />
        <meta name="description" content="University is not enough — COhA ti connette con opportunità, studenti e percorsi oltre l'università." />
        {/* Open Graph — WhatsApp / social preview */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="COhA" />
        <meta property="og:url" content="https://cohaapp.com/" />
        <meta property="og:title" content="COhA — University is not enough" />
        <meta property="og:description" content="University is not enough — COhA ti connette con opportunità, studenti e percorsi oltre l'università." />
        <meta property="og:image" content="https://cohaapp.com/logo-coha-swash.svg" />
        {/* Twitter / X card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="COhA — University is not enough" />
        <meta name="twitter:description" content="University is not enough — COhA ti connette con opportunità, studenti e percorsi oltre l'università." />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="shortcut icon" href="/icon.svg" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="COhA" />
      </head>
      <body className={`${sora.variable} ${dmSans.variable} ${plusJakartaSans.variable} font-body antialiased`}>
        {ONESIGNAL_APP_ID && (
          <Script
            src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
            strategy="afterInteractive"
          />
        )}
        <AnalyticsProvider>
          <QueryProvider>
            <LanguageProvider>
              <PrivacyProvider>
                <AuthProvider>{children}</AuthProvider>
              </PrivacyProvider>
            </LanguageProvider>
            <CookieBanner />
          </QueryProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
