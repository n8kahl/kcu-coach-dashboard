'use client';

import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import type { LeaderboardEntry } from '@/types';

// Mock leaderboard data
const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, user_id: '1', username: 'PrinterKing', avatar_url: undefined, score: 12450, wins: 45, pnl: 8923.50, streak: 8 },
  { rank: 2, user_id: '2', username: 'LTPMaster', avatar_url: undefined, score: 10230, wins: 38, pnl: 6543.20, streak: 5 },
  { rank: 3, user_id: '3', username: 'PatienceCandle', avatar_url: undefined, score: 9870, wins: 36, pnl: 5234.00, streak: 6 },
  { rank: 4, user_id: 'current', username: 'TraderJoe', avatar_url: undefined, score: 8650, wins: 32, pnl: 4823.50, streak: 5 },
  { rank: 5, user_id: '5', username: 'LevelSniper', avatar_url: undefined, score: 7890, wins: 29, pnl: 3456.80, streak: 3 },
  { rank: 6, user_id: '6', username: 'TrendRider', avatar_url: undefined, score: 7234, wins: 27, pnl: 2890.00, streak: 4 },
  { rank: 7, user_id: '7', username: 'ScalpKing', avatar_url: undefined, score: 6890, wins: 25, pnl: 2456.50, streak: 2 },
  { rank: 8, user_id: '8', username: 'VWAPWarrior', avatar_url: undefined, score: 6234, wins: 23, pnl: 1987.30, streak: 1 },
  { rank: 9, user_id: '9', username: 'EMACrosser', avatar_url: undefined, score: 5890, wins: 21, pnl: 1654.00, streak: 3 },
  { rank: 10, user_id: '10', username: 'GreenCandle', avatar_url: undefined, score: 5456, wins: 19, pnl: 1234.50, streak: 2 },
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
