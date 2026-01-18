'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  TrendingUp,
  BookOpen,
  Trophy,
  Medal,
  Share2,
  Users,
  Database,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Palette,
  GraduationCap,
  Target,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  children?: NavItem[];
}

const userNavItems: NavItem[] = [
  { label: 'Overview', href: '/overview', icon: LayoutDashboard },
  { label: 'Companion', href: '/companion', icon: Target },
  { label: 'Learning', href: '/learning', icon: GraduationCap, badge: 'New' },
  { label: 'Progress', href: '/progress', icon: TrendingUp },
  { label: 'Trade Journal', href: '/journal', icon: BookOpen },
  { label: 'Achievements', href: '/achievements', icon: Trophy },
  { label: 'Leaderboard', href: '/leaderboard', icon: Medal },
  { label: 'Win Cards', href: '/win-cards', icon: Share2 },
];

const adminNavItems: NavItem[] = [
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Card Builder', href: '/admin/card-builder', icon: Palette },
  { label: 'Knowledge Base', href: '/admin/knowledge', icon: Database },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

interface SidebarProps {
  user?: {
    username: string;
    avatar_url?: string;
    is_admin?: boolean;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.label);

    return (
      <div key={item.href}>
        <Link
          href={hasChildren ? '#' : item.href}
          onClick={hasChildren ? () => toggleExpanded(item.label) : undefined}
          className={cn(
            'flex items-center gap-3 px-4 py-3',
            'text-sm font-medium transition-all duration-150',
            'border-l-2',
            active
              ? 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)] border-l-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] border-l-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          )}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <Badge variant="gold" size="sm">
                  {item.badge}
                </Badge>
              )}
              {hasChildren && (
                <ChevronDown
                  className={cn(
                    'w-4 h-4 transition-transform duration-200',
                    isExpanded && 'rotate-180'
                  )}
                />
              )}
            </>
          )}
        </Link>
        {hasChildren && !isCollapsed && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="ml-4 border-l border-[var(--border-primary)]">
                  {item.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 ml-2',
                        'text-sm transition-all duration-150',
                        isActive(child.href)
                          ? 'text-[var(--accent-primary)]'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                      )}
                    >
                      <child.icon className="w-4 h-4" />
                      <span>{child.label}</span>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-screen',
        'bg-[var(--bg-secondary)] border-r border-[var(--border-primary)]',
        'flex flex-col',
        'transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-[var(--border-primary)]">
        {!isCollapsed && (
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-[var(--accent-primary)]">KCU</span>
            <span className="text-sm font-medium text-[var(--text-secondary)]">COACH</span>
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {/* Main Nav */}
        <div className="mb-6">
          {!isCollapsed && (
            <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Dashboard
            </p>
          )}
          {userNavItems.map(renderNavItem)}
        </div>

        {/* Admin Nav */}
        {user?.is_admin && (
          <div className="pt-4 border-t border-[var(--border-primary)]">
            {!isCollapsed && (
              <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Admin
              </p>
            )}
            {adminNavItems.map(renderNavItem)}
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-[var(--border-primary)]">
        <div
          className={cn(
            'flex items-center gap-3',
            isCollapsed ? 'justify-center' : ''
          )}
        >
          <Avatar
            src={user?.avatar_url}
            alt={user?.username}
            fallback={user?.username}
            size="md"
            status="online"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {user?.username || 'Guest'}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {user?.is_admin ? 'Admin' : 'Member'}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <button className="p-2 text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

// Mobile Sidebar
export function MobileSidebar({ user }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="lg:hidden fixed top-0 left-0 h-screen w-64 z-50 bg-[var(--bg-secondary)] border-r border-[var(--border-primary)] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-[var(--border-primary)]">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold text-[var(--accent-primary)]">KCU</span>
                <span className="text-sm font-medium text-[var(--text-secondary)]">COACH</span>
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 overflow-y-auto">
              {userNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3',
                      'text-sm font-medium transition-all duration-150',
                      'border-l-2',
                      active
                        ? 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)] border-l-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] border-l-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <Badge variant="gold" size="sm">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}

              {user?.is_admin && (
                <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                  <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Admin
                  </p>
                  {adminNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3',
                          'text-sm font-medium transition-all duration-150',
                          'border-l-2',
                          active
                            ? 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)] border-l-[var(--accent-primary)]'
                            : 'text-[var(--text-secondary)] border-l-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-[var(--border-primary)]">
              <div className="flex items-center gap-3">
                <Avatar
                  src={user?.avatar_url}
                  alt={user?.username}
                  fallback={user?.username}
                  size="md"
                  status="online"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {user?.username || 'Guest'}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {user?.is_admin ? 'Admin' : 'Member'}
                  </p>
                </div>
                <button className="p-2 text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
