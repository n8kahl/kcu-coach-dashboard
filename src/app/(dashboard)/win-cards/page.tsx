'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection, Grid } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  WinCard,
  TradeWinCard,
  StreakWinCard,
  MilestoneWinCard,
  AchievementWinCard,
} from '@/components/cards/win-card';
import { Plus, TrendingUp, Flame, Trophy, Target } from 'lucide-react';
import type { WinCard as WinCardType } from '@/types';

// Mock win cards
const mockWinCards: WinCardType[] = [
  {
    id: '1',
    user_id: 'current',
    type: 'trade',
    title: 'NVDA LONG',
    subtitle: '💰 Winner!',
    stats: [
      { label: 'P&L', value: '+$423.50', color: 'profit', highlight: true },
      { label: 'Return', value: '+12.3%', color: 'profit' },
      { label: 'Entry', value: '$890.50' },
      { label: 'Exit', value: '$1,000.00' },
      { label: 'LTP Grade', value: 'A', color: 'gold' },
      { label: 'Direction', value: 'LONG' },
    ],
    created_at: '2024-01-15T14:30:00Z',
    shared_count: 12,
  },
  {
    id: '2',
    user_id: 'current',
    type: 'streak',
    title: '7 Day Streak! 🔥',
    subtitle: 'Consistency is key',
    stats: [
      { label: 'Streak', value: '7 Days', color: 'gold', highlight: true },
      { label: 'Win Rate', value: '+68.5%', color: 'profit' },
      { label: 'Trades', value: '23' },
      { label: 'Status', value: 'ON FIRE', color: 'gold' },
    ],
    created_at: '2024-01-14T10:00:00Z',
    shared_count: 8,
  },
];

export default function WinCardsPage() {
  const [activeTab, setActiveTab] = useState('my-cards');

  return (
    <>
      <Header
        title="Win Cards"
        subtitle="Create and share your trading achievements"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Win Cards' }]}
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
            Create New
          </Button>
        }
      />

      <PageShell>
        <Tabs defaultValue="my-cards">
          <TabsList variant="underline">
            <TabsTrigger value="my-cards" variant="underline">My Cards</TabsTrigger>
            <TabsTrigger value="create" variant="underline">Create New</TabsTrigger>
            <TabsTrigger value="templates" variant="underline">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="my-cards">
            <PageSection title="Recent Win Cards">
              <Grid cols={2} gap="lg">
                {mockWinCards.map((card) => (
                  <WinCard
                    key={card.id}
                    card={card}
                    username="TraderJoe"
                  />
                ))}
              </Grid>
            </PageSection>
          </TabsContent>

          <TabsContent value="create">
            <PageSection title="Create a New Win Card">
              <Grid cols={2} gap="md">
                {/* Trade Win Card */}
                <Card hoverable className="cursor-pointer">
                  <CardContent className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[var(--accent-primary-glow)] flex items-center justify-center">
                      <TrendingUp className="w-8 h-8 text-[var(--accent-primary)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                      Trade Win Card
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      Celebrate a winning trade with P&L, entry/exit, and LTP grade
                    </p>
                  </CardContent>
                </Card>

                {/* Streak Win Card */}
                <Card hoverable className="cursor-pointer">
                  <CardContent className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[rgba(239,68,68,0.15)] flex items-center justify-center">
                      <Flame className="w-8 h-8 text-[var(--error)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                      Streak Win Card
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      Show off your trading streak and consistency
                    </p>
                  </CardContent>
                </Card>

                {/* Milestone Win Card */}
                <Card hoverable className="cursor-pointer">
                  <CardContent className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[rgba(34,197,94,0.15)] flex items-center justify-center">
                      <Trophy className="w-8 h-8 text-[var(--profit)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                      Milestone Card
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      Celebrate reaching a P&L milestone or learning goal
                    </p>
                  </CardContent>
                </Card>

                {/* Achievement Win Card */}
                <Card hoverable className="cursor-pointer">
                  <CardContent className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[rgba(99,102,241,0.15)] flex items-center justify-center">
                      <Target className="w-8 h-8 text-[var(--accent-secondary)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                      Achievement Card
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      Share an achievement badge you've earned
                    </p>
                  </CardContent>
                </Card>
              </Grid>
            </PageSection>

            {/* Preview Section */}
            <PageSection title="Preview" className="mt-8">
              <div className="flex justify-center">
                <TradeWinCard
                  symbol="SPY"
                  direction="long"
                  entryPrice={458.50}
                  exitPrice={462.30}
                  pnl={380.00}
                  pnlPercent={8.3}
                  ltpGrade="A"
                  username="TraderJoe"
                />
              </div>
            </PageSection>
          </TabsContent>

          <TabsContent value="templates">
            <PageSection title="Card Templates" description="Pre-designed templates for different occasions">
              <Grid cols={3} gap="md">
                {/* Template 1 */}
                <Card hoverable>
                  <CardContent>
                    <Badge variant="gold" size="sm" className="mb-3">Popular</Badge>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">Big Win</h4>
                    <p className="text-xs text-[var(--text-tertiary)]">For trades with 10%+ gains</p>
                  </CardContent>
                </Card>

                {/* Template 2 */}
                <Card hoverable>
                  <CardContent>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">Perfect LTP</h4>
                    <p className="text-xs text-[var(--text-tertiary)]">For A-grade LTP trades</p>
                  </CardContent>
                </Card>

                {/* Template 3 */}
                <Card hoverable>
                  <CardContent>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">Weekly Champion</h4>
                    <p className="text-xs text-[var(--text-tertiary)]">For leaderboard winners</p>
                  </CardContent>
                </Card>

                {/* Template 4 */}
                <Card hoverable>
                  <CardContent>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">First Trade</h4>
                    <p className="text-xs text-[var(--text-tertiary)]">Celebrate your first win</p>
                  </CardContent>
                </Card>

                {/* Template 5 */}
                <Card hoverable>
                  <CardContent>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">Comeback</h4>
                    <p className="text-xs text-[var(--text-tertiary)]">Recovered from losses</p>
                  </CardContent>
                </Card>

                {/* Template 6 */}
                <Card hoverable>
                  <CardContent>
                    <Badge variant="info" size="sm" className="mb-3">New</Badge>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">Custom</h4>
                    <p className="text-xs text-[var(--text-tertiary)]">Design your own</p>
                  </CardContent>
                </Card>
              </Grid>
            </PageSection>
          </TabsContent>
        </Tabs>
      </PageShell>
    </>
  );
}
