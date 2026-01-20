'use client';

import { Sidebar, MobileSidebar } from '@/components/layout/sidebar';
import { MarketStatusBar } from '@/components/layout/header';
import { PageTransition } from '@/components/layout/page-transition';
import { CommandPalette } from '@/components/navigation/command-palette';
import { ToastProvider } from '@/components/ui/toast';
import { AIContextProvider } from '@/components/ai/AIContextProvider';
import { AICommandCenter } from '@/components/ai/AICommandCenter';
import { MarketDataProvider } from '@/providers/MarketDataProvider';
import { useMarketStatusBar } from '@/hooks/useMarketData';

// Wrapper component to use hooks
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { data: marketData, isLoading, isLive } = useMarketStatusBar();

  // Mock user data - would come from auth context in production
  const user = {
    id: 'mock-user-id',
    discordId: 'mock-discord-id',
    username: 'Trader',
    avatarUrl: undefined,
    experienceLevel: 'intermediate' as const,
    subscriptionTier: 'premium' as const,
    isAdmin: true,
    createdAt: new Date('2024-01-01'),
    // Legacy fields for sidebar compatibility
    avatar_url: undefined,
    is_admin: true,
    currentModule: 'ltp-framework',
    streakDays: 7,
    totalQuizzes: 15,
    winRate: 65,
  };

  return (
    <AIContextProvider initialContext={{ user }}>
      <div className="min-h-screen bg-[var(--bg-primary)] bg-hex-pattern">
        {/* Sidebar - Desktop */}
        <div className="hidden lg:block">
          <Sidebar user={user} />
        </div>

        {/* Mobile Sidebar */}
        <MobileSidebar user={user} />

        {/* Main Content */}
        <div className="lg:ml-64">
          {/* Market Status Bar - Now with live data from Massive.com */}
          <MarketStatusBar
            spyPrice={marketData.spyPrice}
            spyChange={marketData.spyChange}
            qqqPrice={marketData.qqqPrice}
            qqqChange={marketData.qqqChange}
            vix={marketData.vix}
            marketStatus={marketData.marketStatus}
            lastUpdated={marketData.lastUpdated || 'Loading...'}
            isLive={isLive}
          />

          {/* Page Content with Premium Transitions */}
          <PageTransition className="p-6">
            {children}
          </PageTransition>
        </div>

        {/* AI Command Center - Right Panel (replaces floating chat) */}
        <AICommandCenter />

        {/* Command Palette - Press Cmd+K to open */}
        <CommandPalette />
      </div>
    </AIContextProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <MarketDataProvider defaultSymbols={['SPY', 'QQQ', 'VIX']}>
        <DashboardContent>{children}</DashboardContent>
      </MarketDataProvider>
    </ToastProvider>
  );
}
