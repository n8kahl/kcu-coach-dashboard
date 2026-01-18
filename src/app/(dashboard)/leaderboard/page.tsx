'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { LeaderboardEntry } from '@/types';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch leaderboard and user data in parallel
        const [leaderboardRes, userRes] = await Promise.all([
          fetch('/api/leaderboard'),
          fetch('/api/user'),
        ]);

        if (!leaderboardRes.ok) {
          throw new Error('Failed to fetch leaderboard');
        }

        const leaderboardData = await leaderboardRes.json();
        setEntries(leaderboardData.entries || []);

        // Get current user ID if authenticated
        if (userRes.ok) {
          const userData = await userRes.json();
          setCurrentUserId(userData.user?.id);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <>
      <Header
        title="Leaderboard"
        subtitle="See how you rank against other traders"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Leaderboard' }]}
      />

      <PageShell maxWidth="lg">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">Loading leaderboard...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="border-[var(--loss)]">
            <CardContent>
              <p className="text-[var(--loss)] text-center py-4">{error}</p>
              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard */}
        {!loading && !error && (
          <Leaderboard entries={entries} currentUserId={currentUserId} />
        )}
      </PageShell>
    </>
  );
}
