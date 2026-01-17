import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KCU Coach | Trading Intelligence Dashboard',
  description: 'AI-powered trading companion and learning platform based on the King Cartel University methodology.',
  keywords: ['trading', 'options', 'AI coach', 'LTP', 'trading journal'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dark-bg font-sans">
        {children}
      </body>
    </html>
  );
}
