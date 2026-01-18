'use client';

import { Sidebar, MobileSidebar } from '@/components/layout/sidebar';
import { MarketStatusBar } from '@/components/layout/header';
import { AICoach } from '@/components/chat/ai-coach';
import { PageTransition } from '@/components/layout/page-transition';
import { CommandPalette } from '@/components/navigation/command-palette';
import { ToastProvider } from '@/components/ui/toast';

// Mock market data (would be fetched from API in production)
const mockMarketData = {
  spyPrice: 459.82,
  spyChange: 0.47,
  qqqPrice: 384.21,
  qqqChange: 0.63,
  vix: 15.47,
  marketStatus: 'open' as const,
  lastUpdated: '12:51 PM ET',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mock user data - would come from auth context in production
  const user = {
    username: 'Trader',
    avatar_url: undefined,
    is_admin: true,
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[var(--bg-primary)] bg-hex-pattern">
        {/* Sidebar - Desktop */}
        <div className="hidden lg:block">
          <Sidebar user={user} />
        </div>

        {/* Mobile Sidebar */}
        <MobileSidebar user={user} />

        {/* Main Content */}
        <div className="lg:ml-64">
          {/* Market Status Bar */}
          <MarketStatusBar {...mockMarketData} />

          {/* Page Content with Premium Transitions */}
          <PageTransition className="p-6">
            {children}
          </PageTransition>
        </div>

        {/* AI Coach Floating Chat */}
        <AICoach />

        {/* Command Palette - Press Cmd+K to open */}
        <CommandPalette />
      </div>
    </ToastProvider>
  );
}
