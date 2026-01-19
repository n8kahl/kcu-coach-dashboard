'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  Target,
  Flame,
  ChevronDown,
  User,
  Calendar,
  RefreshCw,
} from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  totalXp: number;
  currentLevel: number;
  accuracy: number;
  streak: number;
  scenariosCompleted: number;
  isCurrentUser?: boolean;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  timeRange: 'daily' | 'weekly' | 'monthly' | 'all_time';
  onTimeRangeChange: (range: 'daily' | 'weekly' | 'monthly' | 'all_time') => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const TIME_RANGES = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'all_time', label: 'All Time' },
] as const;

const RANK_ICONS = {
  1: { icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-400/20' },
  2: { icon: Medal, color: 'text-slate-300', bg: 'bg-slate-300/20' },
  3: { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-600/20' },
};

function getRankStyle(rank: number) {
  if (rank <= 3) return RANK_ICONS[rank as 1 | 2 | 3];
  return null;
}

function formatXp(xp: number): string {
  if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  return xp.toString();
}

function LeaderboardRow({
  entry,
  index,
}: {
  entry: LeaderboardEntry;
  index: number;
}) {
  const rankStyle = getRankStyle(entry.rank);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg transition-colors',
        entry.isCurrentUser
          ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30'
          : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
      )}
    >
      {/* Rank */}
      <div className="w-10 flex-shrink-0 text-center">
        {rankStyle ? (
          <div className={cn('w-8 h-8 mx-auto rounded-full flex items-center justify-center', rankStyle.bg)}>
            <rankStyle.icon className={cn('w-4 h-4', rankStyle.color)} />
          </div>
        ) : (
          <span className="text-lg font-bold text-[var(--text-tertiary)]">
            #{entry.rank}
          </span>
        )}
      </div>

      {/* Avatar & Name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center overflow-hidden flex-shrink-0">
          {entry.userAvatar ? (
            <img src={entry.userAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-[var(--text-tertiary)]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-medium truncate',
              entry.isCurrentUser ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
            )}>
              {entry.userName}
            </span>
            {entry.isCurrentUser && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                You
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <span>Level {entry.currentLevel}</span>
            <span className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]" />
            <span>{entry.scenariosCompleted} scenarios</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Streak */}
        {entry.streak > 0 && (
          <div className="flex items-center gap-1 text-[var(--warning)]">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-medium">{entry.streak}</span>
          </div>
        )}

        {/* Accuracy */}
        <div className="flex items-center gap-1 text-[var(--text-secondary)]">
          <Target className="w-4 h-4" />
          <span className="text-sm font-medium">{entry.accuracy}%</span>
        </div>

        {/* XP */}
        <div className="w-20 text-right">
          <span className="text-lg font-bold text-[var(--accent-primary)]">
            {formatXp(entry.totalXp)}
          </span>
          <span className="text-xs text-[var(--text-tertiary)] ml-1">XP</span>
        </div>
      </div>
    </motion.div>
  );
}

export function Leaderboard({
  entries,
  currentUserId,
  timeRange,
  onTimeRangeChange,
  isLoading = false,
  onRefresh,
  className,
}: LeaderboardProps) {
  const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);

  // Find current user if not marked
  const entriesWithCurrentUser = entries.map(entry => ({
    ...entry,
    isCurrentUser: entry.isCurrentUser || entry.userId === currentUserId,
  }));

  const currentUserEntry = entriesWithCurrentUser.find(e => e.isCurrentUser);
  const currentUserNotInTop = currentUserEntry && currentUserEntry.rank > entries.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="font-bold text-[var(--text-primary)]">Leaderboard</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Time Range Selector */}
            <div className="relative">
              <button
                onClick={() => setIsTimeRangeOpen(!isTimeRangeOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Calendar className="w-4 h-4" />
                <span>{TIME_RANGES.find(r => r.value === timeRange)?.label}</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', isTimeRangeOpen && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {isTimeRangeOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full right-0 mt-1 z-50 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-lg overflow-hidden"
                  >
                    {TIME_RANGES.map(range => (
                      <button
                        key={range.value}
                        onClick={() => {
                          onTimeRangeChange(range.value);
                          setIsTimeRangeOpen(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg-tertiary)] transition-colors',
                          timeRange === range.value
                            ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                            : 'text-[var(--text-secondary)]'
                        )}
                      >
                        {range.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Refresh */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : entriesWithCurrentUser.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-tertiary)]">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No entries yet</p>
            <p className="text-sm mt-1">Complete practice scenarios to appear on the leaderboard!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entriesWithCurrentUser.slice(0, 10).map((entry, index) => (
              <LeaderboardRow key={entry.userId} entry={entry} index={index} />
            ))}

            {/* Show current user if not in top 10 */}
            {currentUserNotInTop && currentUserEntry && (
              <>
                <div className="flex items-center gap-2 py-2 px-4 text-[var(--text-tertiary)]">
                  <div className="flex-1 h-px bg-[var(--border-primary)]" />
                  <span className="text-xs">...</span>
                  <div className="flex-1 h-px bg-[var(--border-primary)]" />
                </div>
                <LeaderboardRow entry={currentUserEntry} index={10} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      {!isLoading && entriesWithCurrentUser.length > 0 && (
        <div className="px-4 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
            <span>{entriesWithCurrentUser.length} participants</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>Updated live</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Mini leaderboard for sidebar/widget
export function MiniLeaderboard({
  entries,
  currentUserId,
  className,
}: {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  className?: string;
}) {
  const top3 = entries.slice(0, 3).map(entry => ({
    ...entry,
    isCurrentUser: entry.isCurrentUser || entry.userId === currentUserId,
  }));

  return (
    <div className={cn('bg-[var(--bg-secondary)] rounded-lg p-3', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-[var(--accent-primary)]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">Top Players</span>
      </div>

      <div className="space-y-2">
        {top3.map((entry, idx) => {
          const rankStyle = getRankStyle(entry.rank);
          return (
            <div
              key={entry.userId}
              className={cn(
                'flex items-center gap-2 p-2 rounded',
                entry.isCurrentUser ? 'bg-[var(--accent-primary)]/10' : 'bg-[var(--bg-primary)]'
              )}
            >
              <div className="w-6 text-center">
                {rankStyle ? (
                  <rankStyle.icon className={cn('w-4 h-4 mx-auto', rankStyle.color)} />
                ) : (
                  <span className="text-xs text-[var(--text-tertiary)]">#{entry.rank}</span>
                )}
              </div>
              <span className={cn(
                'text-sm flex-1 truncate',
                entry.isCurrentUser ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
              )}>
                {entry.userName}
              </span>
              <span className="text-sm font-medium text-[var(--accent-primary)]">
                {formatXp(entry.totalXp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Leaderboard;
