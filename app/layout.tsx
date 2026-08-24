import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Can Ai',
  description:
    'Local AI chat with live social and news feeds, web search, and price scanning',
  // Lets the app be added to the iOS home screen and run without Safari chrome.
  appleWebApp: { capable: true, title: 'Can Ai', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The camera and bottom nav run to the edges, so the app draws into the
  // notch and home-indicator areas and pads with env(safe-area-inset-*).
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#030712' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
