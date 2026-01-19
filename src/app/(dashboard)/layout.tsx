'use client';

import { Sidebar, MobileSidebar } from '@/components/layout/sidebar';
import { MarketStatusBar } from '@/components/layout/header';
import { PageTransition } from '@/components/layout/page-transition';
import { CommandPalette } from '@/components/navigation/command-palette';
import { ToastProvider } from '@/components/ui/toast';
import { AIContextProvider, AICommandCenter } from '@/components/ai';

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

  // Initial AI context from user data
  const initialAIContext = {
    user: {
      id: '',
      discordId: '',
      username: user.username,
      avatarUrl: user.avatar_url,
      experienceLevel: 'beginner' as const,
      subscriptionTier: 'free' as const,
      isAdmin: user.is_admin,
      createdAt: new Date(),
    },
  };

  return (
    <ToastProvider>
      <AIContextProvider initialContext={initialAIContext}>
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

          {/* AI Command Center - Press Cmd+J to toggle */}
          <AICommandCenter />

          {/* Command Palette - Press Cmd+K to open */}
          <CommandPalette />
        </div>
      </AIContextProvider>
    </ToastProvider>
  );
}
