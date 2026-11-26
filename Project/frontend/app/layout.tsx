import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-heebo',
});

export const metadata: Metadata = {
  title: 'Shadow Ledger',
  description: 'יומן צל ליועץ פיננסי',
  applicationName: 'Shadow Ledger',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Shadow Ledger',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fafafa',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={heebo.variable}>{children}</body>
    </html>
  );
}
