'use client';

import { Sidebar, MobileSidebar } from '@/components/layout/sidebar';

// Mock admin user
const mockUser = {
  username: 'Admin',
  avatar_url: undefined,
  is_admin: true,
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
  );
}
