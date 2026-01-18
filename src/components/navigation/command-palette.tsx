'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Search,
  Home,
  BookOpen,
  BarChart3,
  Target,
  Trophy,
  Settings,
  User,
  LogOut,
  ArrowRight,
  Command,
  TrendingUp,
  Flame,
  Users,
  FileText,
  Share2,
  X,
} from 'lucide-react';

/* =============================================================================
 * COMMAND PALETTE TYPES
 * ============================================================================= */

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action?: () => void;
  href?: string;
  category: 'navigation' | 'action' | 'settings';
  keywords?: string[];
}

interface CommandPaletteProps {
  /** Custom commands to add */
  customCommands?: CommandItem[];
  /** Called when palette opens */
  onOpen?: () => void;
  /** Called when palette closes */
  onClose?: () => void;
}

/* =============================================================================
 * DEFAULT COMMANDS
 * ============================================================================= */

const createDefaultCommands = (router: ReturnType<typeof useRouter>): CommandItem[] => [
  // Navigation
  {
    id: 'nav-overview',
    label: 'Go to Dashboard',
    description: 'View your overview and stats',
    icon: <Home className="w-4 h-4" />,
    shortcut: 'G D',
    href: '/overview',
    category: 'navigation',
    keywords: ['home', 'dashboard', 'main'],
  },
  {
    id: 'nav-journal',
    label: 'Go to Trade Journal',
    description: 'View and log your trades',
    icon: <BookOpen className="w-4 h-4" />,
    shortcut: 'G J',
    href: '/journal',
    category: 'navigation',
    keywords: ['trades', 'journal', 'log', 'history'],
  },
  {
    id: 'nav-analytics',
    label: 'Go to Analytics',
    description: 'View trading performance analytics',
    icon: <BarChart3 className="w-4 h-4" />,
    shortcut: 'G A',
    href: '/analytics',
    category: 'navigation',
    keywords: ['stats', 'performance', 'charts', 'data'],
  },
  {
    id: 'nav-setups',
    label: 'Go to Trade Setups',
    description: 'View your trading setups library',
    icon: <Target className="w-4 h-4" />,
    shortcut: 'G S',
    href: '/setups',
    category: 'navigation',
    keywords: ['setups', 'patterns', 'strategies'],
  },
  {
    id: 'nav-learning',
    label: 'Go to Learning',
    description: 'Continue your trading education',
    icon: <BookOpen className="w-4 h-4" />,
    shortcut: 'G L',
    href: '/learning',
    category: 'navigation',
    keywords: ['learn', 'education', 'courses', 'lessons'],
  },
  {
    id: 'nav-progress',
    label: 'Go to Progress',
    description: 'Track your learning progress',
    icon: <TrendingUp className="w-4 h-4" />,
    shortcut: 'G P',
    href: '/progress',
    category: 'navigation',
    keywords: ['progress', 'xp', 'level', 'streak'],
  },
  {
    id: 'nav-achievements',
    label: 'Go to Achievements',
    description: 'View your earned achievements',
    icon: <Trophy className="w-4 h-4" />,
    shortcut: 'G T',
    href: '/achievements',
    category: 'navigation',
    keywords: ['achievements', 'badges', 'rewards', 'trophies'],
  },
  {
    id: 'nav-leaderboard',
    label: 'Go to Leaderboard',
    description: 'See community rankings',
    icon: <Users className="w-4 h-4" />,
    shortcut: 'G R',
    href: '/leaderboard',
    category: 'navigation',
    keywords: ['leaderboard', 'rankings', 'community', 'top'],
  },
  {
    id: 'nav-companion',
    label: 'Go to AI Companion',
    description: 'Chat with your AI trading coach',
    icon: <Flame className="w-4 h-4" />,
    shortcut: 'G C',
    href: '/companion',
    category: 'navigation',
    keywords: ['ai', 'companion', 'coach', 'assistant', 'chat'],
  },
  {
    id: 'nav-win-cards',
    label: 'Go to Win Cards',
    description: 'Create and share win cards',
    icon: <Share2 className="w-4 h-4" />,
    shortcut: 'G W',
    href: '/win-cards',
    category: 'navigation',
    keywords: ['win', 'cards', 'share', 'social'],
  },

  // Actions
  {
    id: 'action-log-trade',
    label: 'Log New Trade',
    description: 'Record a new trade in your journal',
    icon: <FileText className="w-4 h-4" />,
    shortcut: 'N T',
    href: '/journal?action=new',
    category: 'action',
    keywords: ['new', 'add', 'trade', 'record'],
  },

  // Settings
  {
    id: 'settings-profile',
    label: 'Profile Settings',
    description: 'Manage your profile and preferences',
    icon: <User className="w-4 h-4" />,
    shortcut: 'S P',
    href: '/settings/profile',
    category: 'settings',
    keywords: ['profile', 'account', 'settings', 'preferences'],
  },
  {
    id: 'settings-general',
    label: 'General Settings',
    description: 'App settings and configuration',
    icon: <Settings className="w-4 h-4" />,
    shortcut: 'S G',
    href: '/settings',
    category: 'settings',
    keywords: ['settings', 'config', 'options'],
  },
];

/* =============================================================================
 * COMMAND PALETTE COMPONENT
 * ============================================================================= */

export function CommandPalette({
  customCommands = [],
  onOpen,
  onClose,
}: CommandPaletteProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Create commands with router
  const commands = useMemo(() => {
    return [...createDefaultCommands(router), ...customCommands];
  }, [router, customCommands]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const searchTerms = query.toLowerCase().split(' ');
    return commands.filter((cmd) => {
      const searchableText = [
        cmd.label,
        cmd.description,
        ...(cmd.keywords || []),
      ]
        .join(' ')
        .toLowerCase();

      return searchTerms.every((term) => searchableText.includes(term));
    });
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      action: [],
      settings: [],
    };

    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Open/close handlers
  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
    onClose?.();
  }, [onClose]);

  // Execute command
  const executeCommand = useCallback(
    (command: CommandItem) => {
      close();
      if (command.action) {
        command.action();
      } else if (command.href) {
        router.push(command.href);
      }
    },
    [close, router]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
        return;
      }

      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          close();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) =>
            Math.min(i + 1, filteredCommands.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, open, close, filteredCommands, selectedIndex, executeCommand]);

  // Scroll selected item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.querySelector('[data-selected="true"]');
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Calculate flat index for selected item
  let flatIndex = 0;
  const getIsSelected = (cmd: CommandItem) => {
    const index = flatIndex++;
    return index === selectedIndex;
  };

  // Reset flat index before rendering
  flatIndex = 0;

  return (
    <>
      {/* Keyboard shortcut hint */}
      <button
        onClick={open}
        className={cn(
          'hidden md:flex items-center gap-2 px-3 py-1.5',
          'text-xs text-[var(--text-tertiary)]',
          'border border-[var(--border-secondary)] rounded',
          'hover:border-[var(--border-accent)] hover:text-[var(--text-secondary)]',
          'transition-all duration-fast'
        )}
        aria-label="Open command palette"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search...</span>
        <kbd className="ml-2 px-1.5 py-0.5 text-[10px] bg-[var(--bg-elevated)] rounded">
          ⌘K
        </kbd>
      </button>

      {/* Palette modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={close}
              aria-hidden="true"
            />

            {/* Palette */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'fixed top-[20%] left-1/2 -translate-x-1/2 z-50',
                'w-full max-w-xl',
                'bg-[var(--bg-card)] border border-[var(--border-primary)]',
                'shadow-premium overflow-hidden'
              )}
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 p-4 border-b border-[var(--border-primary)]">
                <Search className="w-5 h-5 text-[var(--text-tertiary)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder="Search commands..."
                  className={cn(
                    'flex-1 bg-transparent text-[var(--text-primary)]',
                    'placeholder:text-[var(--text-tertiary)]',
                    'outline-none'
                  )}
                  aria-label="Search commands"
                />
                <button
                  onClick={close}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Commands list */}
              <div
                ref={listRef}
                className="max-h-[400px] overflow-y-auto p-2"
                role="listbox"
              >
                {filteredCommands.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-tertiary)]">
                    No commands found for "{query}"
                  </div>
                ) : (
                  <>
                    {/* Navigation */}
                    {groupedCommands.navigation.length > 0 && (
                      <CommandGroup
                        label="Navigation"
                        commands={groupedCommands.navigation}
                        selectedIndex={selectedIndex}
                        startIndex={0}
                        onSelect={executeCommand}
                      />
                    )}

                    {/* Actions */}
                    {groupedCommands.action.length > 0 && (
                      <CommandGroup
                        label="Actions"
                        commands={groupedCommands.action}
                        selectedIndex={selectedIndex}
                        startIndex={groupedCommands.navigation.length}
                        onSelect={executeCommand}
                      />
                    )}

                    {/* Settings */}
                    {groupedCommands.settings.length > 0 && (
                      <CommandGroup
                        label="Settings"
                        commands={groupedCommands.settings}
                        selectedIndex={selectedIndex}
                        startIndex={
                          groupedCommands.navigation.length +
                          groupedCommands.action.length
                        }
                        onSelect={executeCommand}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-3 border-t border-[var(--border-primary)] text-xs text-[var(--text-tertiary)]">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] rounded">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] rounded">↵</kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] rounded">esc</kbd>
                    close
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Command className="w-3 h-3" />
                  <span>Command Palette</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* =============================================================================
 * COMMAND GROUP COMPONENT
 * ============================================================================= */

interface CommandGroupProps {
  label: string;
  commands: CommandItem[];
  selectedIndex: number;
  startIndex: number;
  onSelect: (command: CommandItem) => void;
}

function CommandGroup({
  label,
  commands,
  selectedIndex,
  startIndex,
  onSelect,
}: CommandGroupProps) {
  return (
    <div className="mb-2">
      <div className="px-3 py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
        {label}
      </div>
      {commands.map((cmd, index) => {
        const actualIndex = startIndex + index;
        const isSelected = actualIndex === selectedIndex;

        return (
          <button
            key={cmd.id}
            data-selected={isSelected}
            onClick={() => onSelect(cmd)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded',
              'transition-colors duration-fast',
              isSelected
                ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
            )}
            role="option"
            aria-selected={isSelected}
          >
            <span
              className={cn(
                'flex-shrink-0',
                isSelected
                  ? 'text-[var(--bg-primary)]'
                  : 'text-[var(--text-tertiary)]'
              )}
            >
              {cmd.icon}
            </span>
            <div className="flex-1 text-left">
              <div className="font-medium">{cmd.label}</div>
              {cmd.description && (
                <div
                  className={cn(
                    'text-xs',
                    isSelected
                      ? 'text-[var(--bg-primary)]/70'
                      : 'text-[var(--text-tertiary)]'
                  )}
                >
                  {cmd.description}
                </div>
              )}
            </div>
            {cmd.shortcut && (
              <kbd
                className={cn(
                  'px-2 py-0.5 text-xs rounded',
                  isSelected
                    ? 'bg-[var(--bg-primary)]/20'
                    : 'bg-[var(--bg-elevated)]'
                )}
              >
                {cmd.shortcut}
              </kbd>
            )}
            <ArrowRight
              className={cn(
                'w-4 h-4 opacity-0 transition-opacity',
                isSelected && 'opacity-100'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/* =============================================================================
 * KEYBOARD SHORTCUT HOOK
 * For individual components to register shortcuts
 * ============================================================================= */

export function useKeyboardShortcut(
  shortcut: string,
  callback: () => void,
  options: { enabled?: boolean; preventDefault?: boolean } = {}
) {
  const { enabled = true, preventDefault = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const parts = shortcut.toLowerCase().split('+');
      const key = parts.pop();
      const modifiers = parts;

      const hasCtrl = modifiers.includes('ctrl');
      const hasMeta = modifiers.includes('meta') || modifiers.includes('cmd');
      const hasShift = modifiers.includes('shift');
      const hasAlt = modifiers.includes('alt');

      const ctrlMatch = hasCtrl === e.ctrlKey;
      const metaMatch = hasMeta === e.metaKey;
      const shiftMatch = hasShift === e.shiftKey;
      const altMatch = hasAlt === e.altKey;
      const keyMatch = e.key.toLowerCase() === key;

      if (ctrlMatch && metaMatch && shiftMatch && altMatch && keyMatch) {
        if (preventDefault) {
          e.preventDefault();
        }
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, callback, enabled, preventDefault]);
}

export type { CommandItem, CommandPaletteProps };
