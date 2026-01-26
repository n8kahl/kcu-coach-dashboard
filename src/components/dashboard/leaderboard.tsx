'use client';

import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Trophy, Flame, TrendingUp, Medal } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { LeaderboardEntry } from '@/types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  period?: 'weekly' | 'monthly' | 'all-time';
}

export function Leaderboard({ entries, currentUserId, period = 'weekly' }: LeaderboardProps) {
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-6">
      {/* Period Tabs */}
      <Tabs defaultValue={period}>
        <TabsList variant="pills">
          <TabsTrigger value="weekly" variant="pills">This Week</TabsTrigger>
          <TabsTrigger value="monthly" variant="pills">This Month</TabsTrigger>
          <TabsTrigger value="all-time" variant="pills">All Time</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <LeaderboardContent
            top3={top3}
            rest={rest}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="monthly">
          <LeaderboardContent
            top3={top3}
            rest={rest}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="all-time">
          <LeaderboardContent
            top3={top3}
            rest={rest}
            currentUserId={currentUserId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface LeaderboardContentProps {
  top3: LeaderboardEntry[];
  rest: LeaderboardEntry[];
  currentUserId?: string;
}

function LeaderboardContent({ top3, rest, currentUserId }: LeaderboardContentProps) {
  // Empty state when no entries
  if (top3.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-[var(--accent-primary)] opacity-50" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            No Leaderboard Data Yet
          </h3>
          <p className="text-sm text-[var(--text-tertiary)] max-w-md mx-auto">
            The leaderboard will populate as traders log their trades and earn points.
            Start logging trades to climb the ranks!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-4 items-end">
        {/* 2nd Place */}
        {top3[1] && (
          <PodiumCard
            entry={top3[1]}
            position={2}
            isCurrentUser={top3[1].user_id === currentUserId}
          />
        )}

        {/* 1st Place */}
        {top3[0] && (
          <PodiumCard
            entry={top3[0]}
            position={1}
            isCurrentUser={top3[0].user_id === currentUserId}
          />
        )}

        {/* 3rd Place */}
        {top3[2] && (
          <PodiumCard
            entry={top3[2]}
            position={3}
            isCurrentUser={top3[2].user_id === currentUserId}
          />
        )}
      </div>

      {/* Rest of Leaderboard */}
      {rest.length > 0 && (
        <Card>
          <CardContent className="p-0">
            {rest.map((entry, index) => (
              <LeaderboardRow
                key={entry.user_id}
                entry={entry}
                index={index}
                isCurrentUser={entry.user_id === currentUserId}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface PodiumCardProps {
  entry: LeaderboardEntry;
  position: 1 | 2 | 3;
  isCurrentUser: boolean;
}

function PodiumCard({ entry, position, isCurrentUser }: PodiumCardProps) {
  const heights = {
    1: 'h-48',
    2: 'h-40',
    3: 'h-36',
  };

  const icons = {
    1: '🥇',
    2: '🥈',
    3: '🥉',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: position * 0.1 }}
      className={cn(
        position === 1 && 'order-2',
        position === 2 && 'order-1',
        position === 3 && 'order-3'
      )}
    >
      <Card
        variant={isCurrentUser ? 'glow' : 'default'}
        className={cn(
          'flex flex-col items-center p-4',
          heights[position]
        )}
      >
        {/* Avatar with Crown */}
        <div className="relative mb-3">
          {position === 1 && (
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">👑</span>
          )}
          <Avatar
            src={entry.avatar}
            alt={entry.username}
            fallback={entry.username}
            size={position === 1 ? 'xl' : 'lg'}
            bordered={isCurrentUser}
          />
        </div>

        {/* Position Badge */}
        <span className="text-2xl mb-1">{icons[position]}</span>

        {/* Username */}
        <p className={cn(
          'font-semibold text-center truncate w-full',
          isCurrentUser ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
        )}>
          {entry.username}
        </p>

        {/* Score */}
        <p className="text-lg font-bold text-[var(--accent-primary)] mt-1">
          {formatNumber(entry.score)} pts
        </p>

        {/* Stats */}
        <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-tertiary)]">
          <span className={entry.win_rate >= 50 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'}>
            {formatPercent(entry.win_rate)}
          </span>
          <span>•</span>
          <span>{entry.total_trades} trades</span>
        </div>
      </Card>
    </motion.div>
  );
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  index: number;
  isCurrentUser: boolean;
}

function LeaderboardRow({ entry, index, isCurrentUser }: LeaderboardRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-4 p-4 border-b border-[var(--border-primary)]',
        'hover:bg-[var(--bg-card-hover)] transition-colors',
        isCurrentUser && 'bg-[var(--accent-primary-glow)]'
      )}
    >
      {/* Rank */}
      <span className="w-8 text-center font-bold text-[var(--text-tertiary)]">
        {entry.rank}
      </span>

      {/* Avatar & Name */}
      <Avatar
        src={entry.avatar}
        alt={entry.username}
        fallback={entry.username}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-medium truncate',
          isCurrentUser ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
        )}>
          {entry.username}
          {isCurrentUser && (
            <Badge variant="gold" size="sm" className="ml-2">You</Badge>
          )}
        </p>
        <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {entry.total_trades} trades
          </span>
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3" />
            {entry.streak} streak
          </span>
        </div>
      </div>

      {/* Win Rate */}
      <div className="text-right">
        <p className={cn(
          'font-bold',
          entry.win_rate >= 50 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
        )}>
          {formatPercent(entry.win_rate)}
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">win rate</p>
      </div>

      {/* Score */}
      <div className="w-24 text-right">
        <p className="font-bold text-[var(--accent-primary)]">
          {formatNumber(entry.score)}
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">points</p>
      </div>
    </motion.div>
  );
}

// Mini Leaderboard for Dashboard Overview
interface MiniLeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

export function MiniLeaderboard({ entries, currentUserId }: MiniLeaderboardProps) {
  const top5 = entries.slice(0, 5);

  return (
    <Card>
      <CardHeader
        title="Leaderboard"
        subtitle="This week"
        action={
          <a href="/leaderboard" className="text-xs text-[var(--accent-primary)] hover:underline">
            View All
          </a>
        }
      />
      <CardContent>
        <div className="space-y-3">
          {top5.map((entry, index) => {
            const icons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            const isCurrentUser = entry.user_id === currentUserId;

            return (
              <div
                key={entry.user_id}
                className={cn(
                  'flex items-center gap-3 p-2 -mx-2',
                  isCurrentUser && 'bg-[var(--accent-primary-glow)]'
                )}
              >
                <span className="text-lg">{icons[index]}</span>
                <Avatar
                  src={entry.avatar}
                  alt={entry.username}
                  fallback={entry.username}
                  size="sm"
                />
                <span className={cn(
                  'flex-1 text-sm truncate',
                  isCurrentUser ? 'text-[var(--accent-primary)] font-medium' : 'text-[var(--text-primary)]'
                )}>
                  {entry.username}
                </span>
                <span className="text-sm font-bold text-[var(--accent-primary)]">
                  {formatNumber(entry.score)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
