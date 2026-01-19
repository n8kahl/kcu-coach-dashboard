'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection, Grid } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SkeletonCard } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import {
  WinCard,
  TradeWinCard,
  StreakWinCard,
  MilestoneWinCard,
  AchievementWinCard,
} from '@/components/cards/win-card';
import { Plus, TrendingUp, Flame, Trophy, Target, AlertCircle, X } from 'lucide-react';
import type { WinCard as WinCardType, TradeEntry } from '@/types';

type WinCardTemplate = 'trade' | 'streak' | 'milestone' | 'achievement';

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardType: WinCardTemplate;
  onSubmit: (data: Partial<WinCardType>) => void;
  trades: TradeEntry[];
}

function CreateCardModal({ isOpen, onClose, cardType, onSubmit, trades }: CreateCardModalProps) {
  const [selectedTrade, setSelectedTrade] = useState<string>('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trade = trades.find((t) => t.id === selectedTrade);

    if (cardType === 'trade' && trade) {
      onSubmit({
        type: 'trade',
        title: `${trade.symbol} ${trade.direction?.toUpperCase()}`,
        subtitle: subtitle || (trade.pnl && trade.pnl > 100 ? 'Big Winner!' : 'Nice Trade!'),
        trade_id: trade.id,
        stats: [
          { label: 'P&L', value: `+$${trade.pnl?.toFixed(2) || '0'}`, color: 'profit', highlight: true },
          { label: 'Return', value: `+${trade.pnl_percent?.toFixed(1) || '0'}%`, color: 'profit' },
          { label: 'Entry', value: `$${trade.entry_price?.toFixed(2) || '0'}` },
          { label: 'Exit', value: `$${trade.exit_price?.toFixed(2) || '0'}` },
        ],
      });
    } else {
      onSubmit({
        type: cardType,
        title: title || `New ${cardType} Card`,
        subtitle,
        stats: [],
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader
          title={`Create ${cardType.charAt(0).toUpperCase() + cardType.slice(1)} Card`}
          action={
            <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              <X className="w-5 h-5" />
            </button>
          }
        />
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {cardType === 'trade' ? (
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Select a Winning Trade
                </label>
                <select
                  value={selectedTrade}
                  onChange={(e) => setSelectedTrade(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)]"
                  required
                >
                  <option value="">Choose a trade...</option>
                  {trades.filter((t) => t.pnl && t.pnl > 0).map((trade) => (
                    <option key={trade.id} value={trade.id}>
                      {trade.symbol} {trade.direction?.toUpperCase()} - +${trade.pnl?.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`My ${cardType} achievement`}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)]"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Subtitle (optional)
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Add a celebratory message"
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create Card
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WinCardsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [winCards, setWinCards] = useState<WinCardType[]>([]);
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCardType, setSelectedCardType] = useState<WinCardTemplate | null>(null);

  // Fetch win cards and trades on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const [cardsRes, tradesRes] = await Promise.all([
          fetch('/api/win-cards'),
          fetch('/api/trades?limit=20'),
        ]);

        if (cardsRes.status === 401 || tradesRes.status === 401) {
          router.push('/login');
          return;
        }

        if (!cardsRes.ok) {
          throw new Error('Failed to fetch win cards');
        }

        const cardsData = await cardsRes.json();
        const tradesData = tradesRes.ok ? await tradesRes.json() : { trades: [] };

        setWinCards(cardsData.cards || []);
        setTrades(tradesData.trades || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Unable to load your win cards. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  const handleCreateCard = (type: WinCardTemplate) => {
    setSelectedCardType(type);
    setIsCreating(true);
  };

  const handleSubmitCard = async (data: Partial<WinCardType>) => {
    try {
      const response = await fetch('/api/win-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create win card');
      }

      const { card } = await response.json();
      setWinCards((prev) => [card, ...prev]);
      showToast({
        type: 'success',
        title: 'Win Card Created',
        message: 'Your achievement card is ready to share!',
      });
    } catch (err) {
      console.error('Error creating win card:', err);
      showToast({
        type: 'error',
        title: 'Creation Failed',
        message: 'Failed to create win card. Please try again.',
      });
    }
  };

  const handleUseTemplate = (templateName: string) => {
    // Templates map to card types with pre-filled data
    const templateMapping: Record<string, WinCardTemplate> = {
      'Big Win': 'trade',
      'Perfect LTP': 'trade',
      'Weekly Champion': 'milestone',
      'First Trade': 'trade',
      'Comeback': 'milestone',
      'Custom': 'achievement',
    };

    const cardType = templateMapping[templateName] || 'trade';
    handleCreateCard(cardType);
  };

  const handleCreateNewClick = () => {
    // Open the Create New tab
    handleCreateCard('trade');
  };

  if (loading) {
    return (
      <>
        <Header
          title="Win Cards"
          subtitle="Create and share your trading achievements"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Win Cards' }]}
        />
        <PageShell>
          <Grid cols={2} gap="lg">
            <SkeletonCard className="h-64" />
            <SkeletonCard className="h-64" />
            <SkeletonCard className="h-64" />
            <SkeletonCard className="h-64" />
          </Grid>
        </PageShell>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header
          title="Win Cards"
          subtitle="Create and share your trading achievements"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Win Cards' }]}
        />
        <PageShell>
          <Card variant="bordered">
            <CardContent className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[var(--error)]" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Unable to Load Win Cards
              </h3>
              <p className="text-sm text-[var(--text-tertiary)] mb-4">
                {error}
              </p>
              <Button variant="primary" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <Header
        title="Win Cards"
        subtitle="Create and share your trading achievements"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Win Cards' }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleCreateNewClick}
          >
            Create New
          </Button>
        }
      />

      <PageShell>
        <Tabs defaultValue="my-cards">
          <TabsList variant="underline">
            <TabsTrigger value="my-cards" variant="underline">
              My Cards
            </TabsTrigger>
            <TabsTrigger value="create" variant="underline">
              Create New
            </TabsTrigger>
            <TabsTrigger value="templates" variant="underline">
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-cards">
            <PageSection title="Recent Win Cards">
              {winCards.length === 0 ? (
                <Card variant="bordered">
                  <CardContent className="text-center py-12">
                    <Trophy className="w-12 h-12 mx-auto mb-4 text-[var(--accent-primary)]" />
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                      No Win Cards Yet
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)] mb-4">
                      Create your first win card to celebrate your trading achievements!
                    </p>
                    <Button
                      variant="primary"
                      onClick={() => handleCreateCard('trade')}
                    >
                      Create Your First Card
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Grid cols={2} gap="lg">
                  {winCards.map((card) => (
                    <WinCard key={card.id} card={card} username="TraderJoe" />
                  ))}
                </Grid>
              )}
            </PageSection>
          </TabsContent>

          <TabsContent value="create">
            <PageSection title="Create a New Win Card">
              <Grid cols={2} gap="md">
                {/* Trade Win Card */}
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => handleCreateCard('trade')}
                >
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
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => handleCreateCard('streak')}
                >
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
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => handleCreateCard('milestone')}
                >
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
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => handleCreateCard('achievement')}
                >
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
                  entryPrice={458.5}
                  exitPrice={462.3}
                  pnl={380.0}
                  pnlPercent={8.3}
                  ltpGrade="A"
                  username="TraderJoe"
                />
              </div>
            </PageSection>
          </TabsContent>

          <TabsContent value="templates">
            <PageSection
              title="Card Templates"
              description="Pre-designed templates for different occasions"
            >
              <Grid cols={3} gap="md">
                {/* Template 1 */}
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => handleUseTemplate('Big Win')}
                >
                  <CardContent>
                    <Badge variant="gold" size="sm" className="mb-3">
                      Popular
                    </Badge>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">
                      Big Win
                    </h4>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      For trades with 10%+ gains
                    </p>
                  </CardContent>
                </Card>

                {/* Template 2 */}
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => handleUseTemplate('Perfect LTP')}
                >
                  <CardContent>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">
                      Perfect LTP
                    </h4>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      For A-grade LTP trades
                    </p>
                  </CardContent>
                </Card>

                {/* Template 3 */}
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => handleUseTemplate('Weekly Champion')}
                >
                  <CardContent>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">
                      Weekly Champion
                    </h4>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      For leaderboard winners
                    </p>
                  </CardContent>
                </Card>

                {/* Template 4 */}
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => handleUseTemplate('First Trade')}
                >
                  <CardContent>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">
                      First Trade
                    </h4>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Celebrate your first win
                    </p>
                  </CardContent>
                </Card>

                {/* Template 5 */}
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => handleUseTemplate('Comeback')}
                >
                  <CardContent>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">
                      Comeback
                    </h4>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Recovered from losses
                    </p>
                  </CardContent>
                </Card>

                {/* Template 6 */}
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => handleUseTemplate('Custom')}
                >
                  <CardContent>
                    <Badge variant="info" size="sm" className="mb-3">
                      New
                    </Badge>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">
                      Custom
                    </h4>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Design your own
                    </p>
                  </CardContent>
                </Card>
              </Grid>
            </PageSection>
          </TabsContent>
        </Tabs>
      </PageShell>

      {/* Create Card Modal */}
      <CreateCardModal
        isOpen={isCreating && selectedCardType !== null}
        onClose={() => {
          setIsCreating(false);
          setSelectedCardType(null);
        }}
        cardType={selectedCardType || 'trade'}
        onSubmit={handleSubmitCard}
        trades={trades}
      />
    </>
  );
}
