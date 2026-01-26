import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Load Inter font for body text
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Load JetBrains Mono for code/numbers (critical for win card exports)
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const viewport: Viewport = {
  themeColor: '#0d0d0d',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'KCU Coach | Trading Dashboard',
  description: 'Master the LTP Framework - Your AI-powered trading education companion',
  keywords: ['trading', 'day trading', 'options', 'LTP', 'Kay Capitals', 'education'],
  authors: [{ name: 'Kay Capitals University' }],
  openGraph: {
    title: 'KCU Coach | Trading Dashboard',
    description: 'Master the LTP Framework - Your AI-powered trading education companion',
    url: 'https://coach.kaycapitals.com',
    siteName: 'KCU Coach',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KCU Coach | Trading Dashboard',
    description: 'Master the LTP Framework - Your AI-powered trading education companion',
    creator: '@KCUTrading',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

// Cloudflare Stream domain from environment
const cloudflareStreamDomain = process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_DOMAIN;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Preconnect to Cloudflare Stream for faster video loading */}
        <link rel="preconnect" href="https://iframe.cloudflarestream.com" />
        <link rel="dns-prefetch" href="https://iframe.cloudflarestream.com" />

        {/* Preconnect to configured Cloudflare Stream domain if set */}
        {cloudflareStreamDomain && (
          <>
            <link rel="preconnect" href={`https://${cloudflareStreamDomain}`} />
            <link rel="dns-prefetch" href={`https://${cloudflareStreamDomain}`} />
          </>
        )}
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
