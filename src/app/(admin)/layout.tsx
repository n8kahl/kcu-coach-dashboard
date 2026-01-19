'use client';

import { Sidebar, MobileSidebar } from '@/components/layout/sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { AIContextProvider } from '@/components/ai/AIContextProvider';

// Mock admin user
const mockUser = {
  id: 'admin-user-id',
  discordId: 'admin-discord-id',
  username: 'Admin',
  avatar_url: undefined,
  avatarUrl: undefined,
  is_admin: true,
  experienceLevel: 'advanced' as const,
  subscriptionTier: 'premium' as const,
  isAdmin: true,
  createdAt: new Date('2024-01-01'),
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AIContextProvider initialContext={{ user: mockUser }}>
      <ToastProvider>
        <div className="min-h-screen bg-[var(--bg-primary)] bg-hex-pattern">
        {/* Sidebar - Desktop */}
        <div className="hidden lg:block">
          <Sidebar user={mockUser} />
        </div>

        {/* Mobile Sidebar */}
        <MobileSidebar user={mockUser} />

        {/* Main Content */}
        <div className="lg:ml-64">
          {/* Admin Header Bar */}
          <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] px-6 py-2">
            <div className="flex items-center gap-2 text-xs text-[var(--accent-primary)]">
              <span className="w-2 h-2 bg-[var(--accent-primary)]" />
              <span className="font-semibold uppercase tracking-wider">Admin Mode</span>
            </div>
          </div>

          {/* Page Content */}
          <div className="p-6">{children}</div>
        </div>
      </div>
      </ToastProvider>
    </AIContextProvider>
  );
}
