'use client';

import { Sidebar, MobileSidebar } from '@/components/layout/sidebar';
import { MarketStatusBar } from '@/components/layout/header';
import { PageTransition } from '@/components/layout/page-transition';
import { CommandPalette } from '@/components/navigation/command-palette';
import { ToastProvider } from '@/components/ui/toast';
import { AIContextProvider } from '@/components/ai/AIContextProvider';
import { AICommandCenter } from '@/components/ai/AICommandCenter';

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
    <ToastProvider>
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
            {/* Market Status Bar */}
            <MarketStatusBar {...mockMarketData} />

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
    </ToastProvider>
  );
}
