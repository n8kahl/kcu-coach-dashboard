'use client';

import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import type { LeaderboardEntry } from '@/types';

// Mock leaderboard data
const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, user_id: '1', username: 'PrinterKing', avatar: undefined, score: 12450, win_rate: 75.2, total_trades: 60, streak: 8, badges: ['top-10', 'consistent'], change: 'up', change_amount: 2 },
  { rank: 2, user_id: '2', username: 'LTPMaster', avatar: undefined, score: 10230, win_rate: 71.4, total_trades: 53, streak: 5, badges: ['top-10'], change: 'same' },
  { rank: 3, user_id: '3', username: 'PatienceCandle', avatar: undefined, score: 9870, win_rate: 69.2, total_trades: 52, streak: 6, badges: ['top-10'], change: 'up', change_amount: 1 },
  { rank: 4, user_id: 'current', username: 'TraderJoe', avatar: undefined, score: 8650, win_rate: 62.7, total_trades: 51, streak: 5, badges: [], change: 'up', change_amount: 3 },
  { rank: 5, user_id: '5', username: 'LevelSniper', avatar: undefined, score: 7890, win_rate: 60.4, total_trades: 48, streak: 3, badges: [], change: 'down', change_amount: 1 },
  { rank: 6, user_id: '6', username: 'TrendRider', avatar: undefined, score: 7234, win_rate: 58.7, total_trades: 46, streak: 4, badges: [], change: 'same' },
  { rank: 7, user_id: '7', username: 'ScalpKing', avatar: undefined, score: 6890, win_rate: 56.8, total_trades: 44, streak: 2, badges: [], change: 'up', change_amount: 2 },
  { rank: 8, user_id: '8', username: 'VWAPWarrior', avatar: undefined, score: 6234, win_rate: 55.3, total_trades: 42, streak: 1, badges: [], change: 'down', change_amount: 2 },
  { rank: 9, user_id: '9', username: 'EMACrosser', avatar: undefined, score: 5890, win_rate: 53.8, total_trades: 39, streak: 3, badges: [], change: 'up', change_amount: 1 },
  { rank: 10, user_id: '10', username: 'GreenCandle', avatar: undefined, score: 5456, win_rate: 52.1, total_trades: 37, streak: 2, badges: [], change: 'same' },
];

export default function LeaderboardPage() {
  return (
    <>
      <Header
        title="Leaderboard"
        subtitle="See how you rank against other traders"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Leaderboard' }]}
      />

      <PageShell maxWidth="lg">
        <Leaderboard entries={mockLeaderboard} currentUserId="current" />
      </PageShell>
    </>
  );
}
