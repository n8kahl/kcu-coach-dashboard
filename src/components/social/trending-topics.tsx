'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Calendar,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState, ErrorState, SkeletonCard } from '@/components/ui/feedback';
import type { TrendingTopic, TrendingCategory } from '@/types/social';

interface TrendingTopicsProps {
  onGenerateFromTopic: (topic: TrendingTopic) => Promise<void>;
  showToast: (toast: { type: 'success' | 'error'; title: string; message?: string }) => void;
}

const categoryConfig: Record<TrendingCategory, { label: string; color: string }> = {
  economic_data: { label: 'Economic', color: 'info' },
  earnings: { label: 'Earnings', color: 'success' },
  futures: { label: 'Futures', color: 'warning' },
  political: { label: 'Political', color: 'error' },
  market_sentiment: { label: 'Sentiment', color: 'gold' },
  technical: { label: 'Technical', color: 'info' },
  psychology: { label: 'Psychology', color: 'default' },
  news: { label: 'News', color: 'warning' },
  viral: { label: 'Viral', color: 'gold' },
};

export function TrendingTopics({
  onGenerateFromTopic,
  showToast,
}: TrendingTopicsProps) {
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<TrendingCategory | 'all'>('all');

  useEffect(() => {
    fetchTopics();
  }, [categoryFilter]);

  const fetchTopics = async () => {
    setLoading(true);
    setError(null);
    try {
      // For now, use mock data since trending topics endpoint may not exist
      // In production, this would fetch from /api/admin/social/trending
      const mockTopics: TrendingTopic[] = [
        {
          id: '1',
          topic: 'FOMC Meeting Impact on Markets',
          category: 'economic_data',
          source: 'Federal Reserve',
          source_data: {},
          trend_score: 95,
          mention_count: 1250,
          velocity: 'rising',
          content_angles: [
            { hook: 'The Fed just changed the game. Here\'s what it means for day traders...', format: 'reel' }
          ],
          suggested_hooks: ['The Fed just changed the game...', 'Rate decision explained in 60 seconds'],
          relevant_hashtags: ['#FOMC', '#FederalReserve', '#DayTrading', '#StockMarket'],
          is_active: true,
          processed_for_suggestions: false,
          started_trending_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          topic: 'Tech Earnings Season',
          category: 'earnings',
          source: 'Market Data',
          source_data: {},
          trend_score: 88,
          mention_count: 890,
          velocity: 'stable',
          content_angles: [
            { hook: 'Big tech earnings are here. My watchlist...', format: 'feed_post' }
          ],
          suggested_hooks: ['Big tech earnings playbook', 'How I trade earnings season'],
          relevant_hashtags: ['#Earnings', '#TechStocks', '#AAPL', '#MSFT', '#Trading'],
          is_active: true,
          processed_for_suggestions: false,
          started_trending_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '3',
          topic: 'Pre-Market Gap Strategies',
          category: 'technical',
          source: 'Trading Community',
          source_data: {},
          trend_score: 72,
          mention_count: 450,
          velocity: 'rising',
          content_angles: [
            { hook: 'This gap pattern has an 80% win rate...', format: 'reel' }
          ],
          suggested_hooks: ['Gap trading 101', 'My favorite gap setup'],
          relevant_hashtags: ['#GapTrading', '#PreMarket', '#TradingStrategy', '#DayTrader'],
          is_active: true,
          processed_for_suggestions: true,
          started_trending_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Filter by category if selected
      const filtered = categoryFilter === 'all'
        ? mockTopics
        : mockTopics.filter((t) => t.category === categoryFilter);

      setTopics(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trending topics');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (topic: TrendingTopic) => {
    setGeneratingId(topic.id);
    try {
      await onGenerateFromTopic(topic);
    } finally {
      setGeneratingId(null);
    }
  };

  const getVelocityIcon = (velocity: 'rising' | 'stable' | 'falling') => {
    switch (velocity) {
      case 'rising':
        return <TrendingUp className="w-4 h-4 text-[var(--success)]" />;
      case 'falling':
        return <TrendingDown className="w-4 h-4 text-[var(--error)]" />;
      default:
        return <Minus className="w-4 h-4 text-[var(--text-tertiary)]" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load trending topics"
        message={error}
        onRetry={fetchTopics}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as TrendingCategory | 'all')}
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
          >
            <option value="all">All Categories</option>
            {Object.entries(categoryConfig).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="secondary"
          onClick={fetchTopics}
          icon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Topics Grid */}
      {topics.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center">
          <TrendingUp className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No trending topics found</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Topics are updated automatically from market sources
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {topics.map((topic, index) => (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card variant="default" padding="md" className="h-full">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={categoryConfig[topic.category]?.color as 'gold' | 'success' | 'error' | 'warning' | 'info' | 'default' || 'default'}
                        size="sm"
                      >
                        {categoryConfig[topic.category]?.label || topic.category}
                      </Badge>
                      {topic.processed_for_suggestions && (
                        <Badge variant="success" size="sm" dot>
                          Generated
                        </Badge>
                      )}
                    </div>
                    {getVelocityIcon(topic.velocity)}
                  </div>

                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                    {topic.topic}
                  </h3>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-3 text-xs text-[var(--text-tertiary)]">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      Score: {topic.trend_score}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {topic.mention_count?.toLocaleString() || 0} mentions
                    </span>
                  </div>

                  {/* Suggested hooks */}
                  {topic.suggested_hooks && topic.suggested_hooks.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                        Suggested Hooks
                      </p>
                      <ul className="space-y-1">
                        {topic.suggested_hooks.slice(0, 2).map((hook, i) => (
                          <li key={i} className="text-xs text-[var(--accent-primary)]">
                            "{hook}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Hashtags */}
                  {topic.relevant_hashtags && topic.relevant_hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {topic.relevant_hashtags.slice(0, 4).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-[10px] bg-[var(--bg-elevated)] text-[var(--info)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-[var(--border-primary)]">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleGenerate(topic)}
                      loading={generatingId === topic.id}
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                      className="flex-1"
                    >
                      Generate Content
                    </Button>
                    {topic.source_url && (
                      <a
                        href={topic.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
