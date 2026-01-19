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
  AlertCircle,
  Zap,
  Twitter,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState, ErrorState, SkeletonCard } from '@/components/ui/feedback';
import type { TrendingTopic, TrendingCategory } from '@/types/social';

// TikTok icon
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
  </svg>
);

interface TrendingTopicsProps {
  onGenerateFromTopic: (topic: TrendingTopic) => Promise<void>;
  showToast: (toast: { type: 'success' | 'error' | 'info'; title: string; message?: string }) => void;
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

const sourceConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  all: { label: 'All Sources', icon: <TrendingUp className="w-4 h-4" /> },
  x_twitter: { label: 'X / Twitter', icon: <Twitter className="w-4 h-4" /> },
  tiktok: { label: 'TikTok', icon: <TikTokIcon className="w-4 h-4" /> },
  news: { label: 'News', icon: <BarChart3 className="w-4 h-4" /> },
  ai: { label: 'AI Generated', icon: <Sparkles className="w-4 h-4" /> },
};

export function TrendingTopics({
  onGenerateFromTopic,
  showToast,
}: TrendingTopicsProps) {
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<TrendingCategory | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  useEffect(() => {
    fetchTopics();
  }, [categoryFilter, sourceFilter]);

  const fetchTopics = async (refresh: boolean = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (sourceFilter !== 'all') params.append('source', sourceFilter);
      if (refresh) params.append('refresh', 'true');
      params.append('limit', '20');

      const response = await fetch(`/api/admin/social/trending?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch trending topics');
      }

      setTopics(data.data || []);

      if (refresh) {
        showToast({
          type: 'success',
          title: 'Topics refreshed',
          message: `Found ${data.data?.length || 0} trending topics`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trending topics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const aggregateFromSources = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/admin/social/trending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to aggregate topics');
      }

      setTopics(data.data || []);
      showToast({
        type: 'success',
        title: 'Topics aggregated',
        message: `Scraped ${data.data?.length || 0} topics from X, TikTok, and news sources`,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Aggregation failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setRefreshing(false);
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

  const getSourceBadge = (source: string) => {
    if (source?.includes('twitter') || source?.includes('x_')) {
      return { icon: <Twitter className="w-3 h-3" />, label: 'X' };
    }
    if (source?.includes('tiktok')) {
      return { icon: <TikTokIcon className="w-3 h-3" />, label: 'TikTok' };
    }
    if (source?.includes('news') || source?.includes('api')) {
      return { icon: <BarChart3 className="w-3 h-3" />, label: 'News' };
    }
    if (source?.includes('ai') || source?.includes('fallback')) {
      return { icon: <Sparkles className="w-3 h-3" />, label: 'AI' };
    }
    return { icon: <TrendingUp className="w-3 h-3" />, label: source };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            >
              {Object.entries(sourceConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
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

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => fetchTopics(true)}
              disabled={refreshing}
              icon={refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              onClick={aggregateFromSources}
              disabled={refreshing}
              icon={<Zap className="w-4 h-4" />}
            >
              Scrape Now
            </Button>
          </div>
        </div>

        {/* Source info banner */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-3 text-xs text-[var(--text-tertiary)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>
              Trending topics are scraped from <strong>X/Twitter</strong>, <strong>TikTok</strong>, and <strong>financial news</strong> sources.
              Click "Scrape Now" to fetch the latest topics about options trading, economic events, and market news.
            </span>
          </div>
        </div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={categoryConfig[topic.category]?.color as 'gold' | 'success' | 'error' | 'warning' | 'info' | 'default' || 'default'}
                        size="sm"
                      >
                        {categoryConfig[topic.category]?.label || topic.category}
                      </Badge>
                      {topic.source && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-[var(--bg-elevated)] text-[var(--text-tertiary)]">
                          {getSourceBadge(topic.source).icon}
                          {getSourceBadge(topic.source).label}
                        </span>
                      )}
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
