'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Users,
  RefreshCw,
  Search,
  ExternalLink,
  Trash2,
  MoreVertical,
  TrendingUp,
  Clock,
  Filter,
  ChevronDown
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState, ErrorState, SkeletonCard } from '@/components/ui/feedback';
import { PlatformBadge } from './platform-badge';
import type { InfluencerProfile, SocialPlatform } from '@/types/social';

interface InfluencerListProps {
  onAddInfluencer: () => void;
  onScrapeAll: () => Promise<void>;
  showToast: (toast: { type: 'success' | 'error'; title: string; message?: string }) => void;
}

export function InfluencerList({
  onAddInfluencer,
  onScrapeAll,
  showToast,
}: InfluencerListProps) {
  const [influencers, setInfluencers] = useState<InfluencerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    fetchInfluencers();
  }, []);

  const fetchInfluencers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (platformFilter !== 'all') params.append('platform', platformFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const response = await fetch(`/api/admin/social/influencers?${params}`);
      const data = await response.json();

      if (data.success) {
        setInfluencers(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch influencers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load influencers');
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (influencerId: string) => {
    setScrapingId(influencerId);
    try {
      const response = await fetch('/api/admin/social/influencers/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencer_id: influencerId }),
      });

      const data = await response.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: 'Scrape complete',
          message: `Scraped ${data.posts_scraped} posts`,
        });
        fetchInfluencers();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Scrape failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setScrapingId(null);
    }
  };

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      await onScrapeAll();
      fetchInfluencers();
    } finally {
      setScraping(false);
    }
  };

  const handleDelete = async (influencerId: string) => {
    try {
      const response = await fetch(`/api/admin/social/influencers?id=${influencerId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: 'Influencer removed',
        });
        setInfluencers((prev) => prev.filter((i) => i.id !== influencerId));
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Delete failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const filteredInfluencers = influencers.filter((inf) => {
    const matchesSearch =
      inf.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inf.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const priorityColors = {
    high: 'error',
    medium: 'warning',
    low: 'success',
  } as const;

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
        title="Failed to load influencers"
        message={error}
        onRetry={fetchInfluencers}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search influencers..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </div>

          {/* Platform filter */}
          <select
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value as SocialPlatform | 'all');
              fetchInfluencers();
            }}
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
          >
            <option value="all">All Platforms</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value as 'all' | 'high' | 'medium' | 'low');
              fetchInfluencers();
            }}
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleScrapeAll}
            loading={scraping}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Scrape All
          </Button>
          <Button variant="primary" onClick={onAddInfluencer}>
            Add Influencer
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card variant="default" padding="md">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{influencers.length}</p>
        </Card>
        <Card variant="default" padding="md">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Instagram</p>
          <p className="text-2xl font-bold text-[#E1306C]">
            {influencers.filter((i) => i.platform === 'instagram').length}
          </p>
        </Card>
        <Card variant="default" padding="md">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">TikTok</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">
            {influencers.filter((i) => i.platform === 'tiktok').length}
          </p>
        </Card>
        <Card variant="default" padding="md">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">YouTube</p>
          <p className="text-2xl font-bold text-[#FF0000]">
            {influencers.filter((i) => i.platform === 'youtube').length}
          </p>
        </Card>
      </div>

      {/* List */}
      {filteredInfluencers.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center">
          <Users className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No influencers found</p>
          <Button variant="primary" onClick={onAddInfluencer} className="mt-4">
            Add Your First Influencer
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredInfluencers.map((influencer, index) => (
              <motion.div
                key={influencer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card variant="default" padding="md" hoverable>
                  <div className="flex items-center gap-4">
                    {/* Avatar/Icon */}
                    <div className="w-12 h-12 bg-[var(--bg-elevated)] flex items-center justify-center">
                      {influencer.profile_image_url ? (
                        <img
                          src={influencer.profile_image_url}
                          alt={influencer.handle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-6 h-6 text-[var(--text-tertiary)]" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={influencer.platform} size="sm" showLabel={false} />
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          @{influencer.handle}
                        </span>
                        {influencer.display_name && (
                          <span className="text-sm text-[var(--text-tertiary)]">
                            ({influencer.display_name})
                          </span>
                        )}
                        <Badge variant={priorityColors[influencer.priority]} size="sm">
                          {influencer.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-tertiary)]">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {influencer.followers_count?.toLocaleString() || 0} followers
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {(influencer.engagement_rate || 0).toFixed(2)}% engagement
                        </span>
                        {influencer.last_scraped_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last scraped: {new Date(influencer.last_scraped_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleScrape(influencer.id)}
                        loading={scrapingId === influencer.id}
                        icon={<RefreshCw className="w-4 h-4" />}
                      />
                      {influencer.profile_url && (
                        <a
                          href={influencer.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(influencer.id)}
                        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
