'use client';

// ============================================
// Market Pulse Component
// Real-time news reactions using @kaycapitals voice
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Zap,
  Instagram,
  Twitter,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/feedback';

// ============================================
// Types (matching trending-aggregator.ts)
// ============================================

interface NewsItem {
  id: string;
  title: string;
  description?: string;
  source: string;
  sourceUrl?: string;
  publishedAt: string;
  category: string;
  triggerTopics: string[];
  urgency: 'breaking' | 'high' | 'medium' | 'low';
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

interface ReactionContent {
  id: string;
  newsItem: NewsItem;
  instagramCaption: string;
  twitterPost: string;
  hook: string;
  emojis: string[];
  hashtags: string[];
  cta: string;
  tradingInsight?: string;
  generatedAt: string;
}

interface MarketPulseProps {
  showToast: (toast: { type: 'success' | 'error' | 'info'; title: string; message?: string }) => void;
}

// ============================================
// Sub-Components
// ============================================

function UrgencyBadge({ urgency }: { urgency: NewsItem['urgency'] }) {
  const config = {
    breaking: { label: 'BREAKING', color: 'bg-red-500/20 text-red-400 border-red-500/30', pulse: true },
    high: { label: 'HIGH', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', pulse: false },
    medium: { label: 'MEDIUM', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', pulse: false },
    low: { label: 'LOW', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', pulse: false },
  };

  const { label, color, pulse } = config[urgency];

  return (
    <Badge className={`${color} border text-xs font-semibold ${pulse ? 'animate-pulse' : ''}`}>
      {urgency === 'breaking' && <AlertTriangle className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );
}

function SentimentIndicator({ sentiment }: { sentiment?: NewsItem['sentiment'] }) {
  if (!sentiment) return null;

  const config = {
    bullish: { icon: TrendingUp, color: 'text-green-400', label: 'Bullish' },
    bearish: { icon: TrendingDown, color: 'text-red-400', label: 'Bearish' },
    neutral: { icon: Minus, color: 'text-gray-400', label: 'Neutral' },
  };

  const { icon: Icon, color, label } = config[sentiment];

  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function TimeAgo({ date }: { date: string }) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
      if (minutes < 1) setTimeAgo('Just now');
      else if (minutes < 60) setTimeAgo(`${minutes}m ago`);
      else if (minutes < 1440) setTimeAgo(`${Math.floor(minutes / 60)}h ago`);
      else setTimeAgo(`${Math.floor(minutes / 1440)}d ago`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [date]);

  return (
    <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
      <Clock className="w-3 h-3" />
      {timeAgo}
    </span>
  );
}

function NewsCard({
  news,
  onGenerateReaction,
  isGenerating,
  reaction,
}: {
  news: NewsItem;
  onGenerateReaction: (news: NewsItem) => void;
  isGenerating: boolean;
  reaction?: ReactionContent;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<'instagram' | 'twitter' | null>(null);

  const handleCopy = async (text: string, platform: 'instagram' | 'twitter') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(platform);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card variant="default" padding="md" className="relative overflow-hidden">
        {/* Urgency indicator bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            news.urgency === 'breaking'
              ? 'bg-red-500'
              : news.urgency === 'high'
                ? 'bg-orange-500'
                : news.urgency === 'medium'
                  ? 'bg-yellow-500'
                  : 'bg-gray-500'
          }`}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pt-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <UrgencyBadge urgency={news.urgency} />
              <SentimentIndicator sentiment={news.sentiment} />
              <TimeAgo date={news.publishedAt} />
            </div>
            <h3 className="text-[var(--text-primary)] font-medium leading-snug mb-1">
              {news.title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--text-tertiary)]">{news.source}</span>
              {news.sourceUrl && (
                <a
                  href={news.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-primary)] hover:underline flex items-center gap-1 text-xs"
                >
                  <ExternalLink className="w-3 h-3" />
                  Source
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Trigger Topics */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {news.triggerTopics.map((topic) => (
            <Badge key={topic} variant="default" size="sm">
              {topic}
            </Badge>
          ))}
        </div>

        {/* Description */}
        {news.description && (
          <p className="text-sm text-[var(--text-secondary)] mt-3 line-clamp-2">
            {news.description}
          </p>
        )}

        {/* Action Button */}
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onGenerateReaction(news)}
            loading={isGenerating}
            icon={<Zap className="w-4 h-4" />}
            disabled={!!reaction}
          >
            {reaction ? 'Generated!' : "Generate @kaycapitals Take"}
          </Button>
        </div>

        {/* Generated Reaction */}
        <AnimatePresence>
          {reaction && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 border-t border-[var(--border-primary)] pt-4"
            >
              {/* Hook Preview */}
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[var(--accent-gold)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {reaction.hook}
                </span>
              </div>

              {/* Trading Insight */}
              {reaction.tradingInsight && (
                <p className="text-sm text-[var(--text-secondary)] mb-3 italic">
                  💡 {reaction.tradingInsight}
                </p>
              )}

              {/* Expand/Collapse Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                icon={expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                className="mb-3"
              >
                {expanded ? 'Hide Full Content' : 'Show Full Content'}
              </Button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    {/* Instagram Caption */}
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Instagram className="w-4 h-4 text-pink-500" />
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            Instagram Caption
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(reaction.instagramCaption, 'instagram')}
                          icon={
                            copied === 'instagram' ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )
                          }
                        >
                          {copied === 'instagram' ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                      <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-sans">
                        {reaction.instagramCaption}
                      </pre>
                    </div>

                    {/* Twitter Post */}
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Twitter className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            Twitter/X Post
                          </span>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            ({reaction.twitterPost.length}/280)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(reaction.twitterPost, 'twitter')}
                          icon={
                            copied === 'twitter' ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )
                          }
                        >
                          {copied === 'twitter' ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{reaction.twitterPost}</p>
                    </div>

                    {/* Hashtags */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[var(--text-tertiary)]">Suggested Hashtags:</span>
                      {reaction.hashtags.map((tag) => (
                        <Badge key={tag} variant="default" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================

export function MarketPulse({ showToast }: MarketPulseProps) {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionContent>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Fetch news on mount
  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/social/market-pulse');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch news');
      }

      setNewsItems(data.data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
      showToast({
        type: 'error',
        title: 'Failed to fetch news',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNews();
    showToast({ type: 'success', title: 'News refreshed' });
  };

  const handleGenerateReaction = async (news: NewsItem) => {
    setGeneratingId(news.id);

    try {
      const response = await fetch('/api/admin/social/market-pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsItem: news }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate reaction');
      }

      setReactions((prev) => ({
        ...prev,
        [news.id]: data.data,
      }));

      showToast({
        type: 'success',
        title: 'Reaction generated!',
        message: "Instagram caption ready in Somesh's voice",
      });
    } catch (error) {
      console.error('Error generating reaction:', error);
      showToast({
        type: 'error',
        title: 'Generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setGeneratingId(null);
    }
  };

  if (loading) {
    return <LoadingState text="Fetching market pulse..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[var(--accent-gold)]" />
            Market Pulse
          </h2>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Real-time news reactions using @kaycapitals voice
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleRefresh}
          loading={refreshing}
          icon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* News List */}
      {newsItems.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center">
          <AlertTriangle className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            No Breaking News
          </h3>
          <p className="text-[var(--text-secondary)] mb-4">
            No trigger topics detected in recent news. Check back soon!
          </p>
          <Button variant="secondary" onClick={handleRefresh}>
            Refresh Feed
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {newsItems.map((news) => (
              <NewsCard
                key={news.id}
                news={news}
                onGenerateReaction={handleGenerateReaction}
                isGenerating={generatingId === news.id}
                reaction={reactions[news.id]}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Trigger Topics Info */}
      <Card variant="default" padding="md" className="mt-6">
        <CardHeader
          title="Trigger Topics"
          icon={<Zap className="w-5 h-5" />}
          className="mb-3"
        />
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          News is filtered for these topics that Somesh typically reacts to:
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            'Trump', 'Powell', 'SPY', '0DTE', 'Gamma Levels', 'FOMC', 'Fed',
            'Interest Rate', 'CPI', 'VIX', 'Tariff', 'Recession', 'Inflation',
          ].map((topic) => (
            <Badge key={topic} variant="default" size="sm">
              {topic}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
