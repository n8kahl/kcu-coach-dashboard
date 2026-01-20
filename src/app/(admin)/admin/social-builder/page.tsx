'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Instagram,
  Youtube,
  Users,
  TrendingUp,
  Sparkles,
  Calendar,
  BarChart3,
  Settings,
  Plus,
  RefreshCw,
  Zap,
  Clock,
  GraduationCap,
  Wand2,
} from 'lucide-react';

// UI Components
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Stat } from '@/components/ui/stat';
import { LoadingState, ErrorState, SkeletonStats } from '@/components/ui/feedback';

// Social Components
import {
  PlatformBadge,
  CategoryBadge,
  SuggestionListItem,
  ToastProvider,
  useToast,
  ConfirmDialog,
  ContentPreviewModal,
  SettingsModal,
  AddInfluencerModal,
  InfluencerList,
  TrendingTopics,
  LearningMilestones,
  BrainDumpInput,
} from '@/components/social';

import type { ContentSuggestion, SocialPlatform, TrendingTopic, InfluencerProfileInput, ContentCategory } from '@/types/social';

// ============================================
// Types
// ============================================

interface DashboardStats {
  total_followers: number;
  followers_change_7d: number;
  total_posts_30d: number;
  average_engagement_rate: number;
  pending_suggestions: number;
  approved_suggestions: number;
  scheduled_posts: number;
  tracked_influencers: number;
  trending_topics: number;
}

interface PlatformConnection {
  platform: SocialPlatform;
  connected: boolean;
  handle?: string;
  followers?: number;
}

// ============================================
// Main Component
// ============================================

function SocialBuilderContent() {
  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [lastSyncedDisplay, setLastSyncedDisplay] = useState<string>('Never');

  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showAddInfluencer, setShowAddInfluencer] = useState(false);
  const [previewSuggestion, setPreviewSuggestion] = useState<ContentSuggestion | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
    variant: 'danger' | 'warning';
  } | null>(null);

  // Platform connections (mock for now)
  const [platforms] = useState<PlatformConnection[]>([
    { platform: 'instagram', connected: false },
    { platform: 'tiktok', connected: false },
    { platform: 'youtube', connected: false },
  ]);

  const { showToast } = useToast();

  // ============================================
  // Data Fetching
  // ============================================

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [suggestionsRes, influencersRes] = await Promise.all([
        fetch('/api/admin/social/suggestions?status=pending&limit=10'),
        fetch('/api/admin/social/influencers?limit=1'),
      ]);

      const suggestionsData = await suggestionsRes.json();
      const influencersData = await influencersRes.json();

      if (!suggestionsRes.ok) {
        throw new Error(suggestionsData.error || 'Failed to fetch suggestions');
      }

      setSuggestions(suggestionsData.data || []);

      // Calculate stats
      setStats({
        total_followers: 0,
        followers_change_7d: 0,
        total_posts_30d: 0,
        average_engagement_rate: 0,
        pending_suggestions: suggestionsData.total || 0,
        approved_suggestions: 0,
        scheduled_posts: 0,
        tracked_influencers: influencersData.total || 0,
        trending_topics: 3, // Mock for now
      });

      // Update last synced timestamp
      setLastSynced(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
      showToast({ type: 'error', title: 'Error loading data', message });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 60 seconds
    const refreshInterval = setInterval(fetchDashboardData, 60000);

    return () => clearInterval(refreshInterval);
  }, [fetchDashboardData]);

  // Update relative time display every 30 seconds
  useEffect(() => {
    const updateRelativeTime = () => {
      if (lastSynced) {
        const now = new Date();
        const diffMs = now.getTime() - lastSynced.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffMs / 60000);

        if (diffSecs < 10) {
          setLastSyncedDisplay('Just now');
        } else if (diffSecs < 60) {
          setLastSyncedDisplay(`${diffSecs}s ago`);
        } else if (diffMins < 60) {
          setLastSyncedDisplay(`${diffMins}m ago`);
        } else {
          setLastSyncedDisplay(lastSynced.toLocaleTimeString());
        }
      }
    };

    updateRelativeTime();
    const displayInterval = setInterval(updateRelativeTime, 30000);

    return () => clearInterval(displayInterval);
  }, [lastSynced]);

  // ============================================
  // Actions
  // ============================================

  const generateContent = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/admin/social/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: ['instagram', 'tiktok'],
          count: 5,
          include_trending: true,
          include_influencer_posts: true,
          include_kcu_data: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: 'Content generated',
          message: `Created ${data.suggestions?.length || 0} new suggestions`,
        });
        fetchDashboardData();
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Generation failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSuggestionAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch('/api/admin/social/suggestions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });

      const data = await response.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: action === 'approve' ? 'Content approved' : 'Content rejected',
        });
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
        setStats((prev) =>
          prev
            ? {
                ...prev,
                pending_suggestions: Math.max(0, prev.pending_suggestions - 1),
                approved_suggestions:
                  action === 'approve' ? prev.approved_suggestions + 1 : prev.approved_suggestions,
              }
            : null
        );
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Action failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleAddInfluencer = async (influencer: InfluencerProfileInput) => {
    const response = await fetch('/api/admin/social/influencers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(influencer),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to add influencer');
    }

    showToast({
      type: 'success',
      title: 'Influencer added',
      message: `Now tracking @${influencer.handle}`,
    });

    setStats((prev) =>
      prev ? { ...prev, tracked_influencers: prev.tracked_influencers + 1 } : null
    );
  };

  const handleScrapeAll = async () => {
    const response = await fetch('/api/admin/social/influencers/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scrape_all: true }),
    });

    const data = await response.json();
    if (data.success) {
      showToast({
        type: 'success',
        title: 'Scraping complete',
        message: `Updated ${data.results?.length || 0} influencers`,
      });
    } else {
      throw new Error(data.error);
    }
  };

  const handleGenerateFromTopic = async (topic: TrendingTopic) => {
    try {
      const response = await fetch('/api/admin/social/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: ['instagram', 'tiktok'],
          count: 3,
          topic: topic.topic,
          category: topic.category,
        }),
      });

      const data = await response.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: 'Content generated',
          message: `Created ${data.suggestions?.length || 0} suggestions from "${topic.topic}"`,
        });
        fetchDashboardData();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Generation failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const quickActions = [
    {
      id: 'add-influencer',
      label: 'Add Influencer',
      description: 'Track a new day trading influencer',
      icon: Plus,
      color: 'var(--info)',
      onClick: () => setShowAddInfluencer(true),
    },
    {
      id: 'scrape-all',
      label: 'Scrape All',
      description: 'Update all influencer content',
      icon: RefreshCw,
      color: 'var(--success)',
      onClick: () => {
        setConfirmAction({
          isOpen: true,
          title: 'Scrape All Influencers',
          message: 'This will update content from all tracked influencers. This may take a few minutes.',
          variant: 'warning',
          onConfirm: handleScrapeAll,
        });
      },
    },
    {
      id: 'content-calendar',
      label: 'Content Calendar',
      description: 'View and schedule posts',
      icon: Calendar,
      color: 'rgba(139,92,246,1)',
      onClick: () => showToast({ type: 'info', title: 'Coming soon', message: 'Content calendar is in development' }),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      description: 'View performance metrics',
      icon: BarChart3,
      color: 'var(--accent-primary)',
      onClick: () => showToast({ type: 'info', title: 'Coming soon', message: 'Analytics dashboard is in development' }),
    },
  ];

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] flex items-center gap-3">
              <div className="p-2 bg-[var(--accent-primary)]">
                <Sparkles className="w-6 h-6 text-[var(--bg-primary)]" />
              </div>
              KCU Social Builder
            </h1>
            <p className="text-[var(--text-tertiary)] mt-1">
              AI-powered social media management for day trading content
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default" size="sm" className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>Synced {lastSyncedDisplay}</span>
            </Badge>
            <Button
              variant="primary"
              onClick={generateContent}
              loading={generating}
              icon={<Zap className="w-4 h-4" />}
            >
              Generate Content
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowSettings(true)}
              icon={<Settings className="w-4 h-4" />}
            >
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList variant="pills">
          <TabsTrigger value="overview" variant="pills">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="suggestions" variant="pills">
            <Sparkles className="w-4 h-4 mr-2" />
            Suggestions
            {stats?.pending_suggestions ? (
              <Badge variant="gold" size="sm" className="ml-2">
                {stats.pending_suggestions}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="influencers" variant="pills">
            <Users className="w-4 h-4 mr-2" />
            Influencers
          </TabsTrigger>
          <TabsTrigger value="trending" variant="pills">
            <TrendingUp className="w-4 h-4 mr-2" />
            Trending
          </TabsTrigger>
          <TabsTrigger value="learning" variant="pills">
            <GraduationCap className="w-4 h-4 mr-2" />
            Learning
          </TabsTrigger>
          <TabsTrigger value="brain-dump" variant="pills">
            <Wand2 className="w-4 h-4 mr-2" />
            Brain Dump
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          {loading ? (
            <SkeletonStats count={4} />
          ) : error ? (
            <ErrorState title="Error loading stats" message={error} onRetry={fetchDashboardData} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card variant="default" padding="md">
                <CardHeader
                  title="Pending Suggestions"
                  icon={<Sparkles className="w-5 h-5" />}
                />
                <Stat
                  label=""
                  value={stats?.pending_suggestions || 0}
                  valueColor="gold"
                  variant="large"
                />
              </Card>

              <Card variant="default" padding="md">
                <CardHeader
                  title="Tracked Influencers"
                  icon={<Users className="w-5 h-5" />}
                />
                <Stat
                  label=""
                  value={stats?.tracked_influencers || 0}
                  variant="large"
                />
              </Card>

              <Card variant="default" padding="md">
                <CardHeader
                  title="Scheduled Posts"
                  icon={<Calendar className="w-5 h-5" />}
                />
                <Stat
                  label=""
                  value={stats?.scheduled_posts || 0}
                  variant="large"
                />
              </Card>

              <Card variant="default" padding="md">
                <CardHeader
                  title="Trending Topics"
                  icon={<TrendingUp className="w-5 h-5" />}
                />
                <Stat
                  label=""
                  value={stats?.trending_topics || 0}
                  variant="large"
                />
              </Card>
            </div>
          )}

          {/* Platform Connections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {platforms.map((platform) => (
              <Card key={platform.platform} variant="default" padding="md">
                <div className="flex items-center gap-3 mb-4">
                  <PlatformBadge platform={platform.platform} size="lg" showLabel={false} />
                  <div>
                    <h3 className="text-[var(--text-primary)] font-medium capitalize">
                      {platform.platform}
                    </h3>
                    <p className="text-[var(--text-tertiary)] text-sm">
                      {platform.connected ? `@${platform.handle}` : 'Not connected'}
                    </p>
                  </div>
                  {platform.connected && (
                    <Badge variant="success" size="sm" className="ml-auto" dot pulse>
                      Connected
                    </Badge>
                  )}
                </div>
                <Button
                  variant={platform.connected ? 'ghost' : 'secondary'}
                  fullWidth
                  onClick={() =>
                    showToast({
                      type: 'info',
                      title: 'Coming soon',
                      message: `${platform.platform} connection coming soon`,
                    })
                  }
                >
                  {platform.connected ? 'Manage' : 'Connect Account'}
                </Button>
              </Card>
            ))}
          </div>

          {/* Recent Suggestions */}
          <Card variant="default" padding="none">
            <CardHeader
              title="AI Content Suggestions"
              icon={<Sparkles className="w-5 h-5" />}
              action={
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              }
              className="p-4 border-b border-[var(--border-primary)]"
            />

            {loading ? (
              <LoadingState text="Loading suggestions..." />
            ) : suggestions.length === 0 ? (
              <div className="p-8 text-center">
                <Sparkles className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
                <p className="text-[var(--text-secondary)]">No pending suggestions</p>
                <Button
                  variant="primary"
                  onClick={generateContent}
                  loading={generating}
                  className="mt-4"
                >
                  Generate New Content
                </Button>
              </div>
            ) : (
              <AnimatePresence>
                {suggestions.slice(0, 5).map((suggestion) => (
                  <SuggestionListItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApprove={(id) => handleSuggestionAction(id, 'approve')}
                    onReject={(id) => handleSuggestionAction(id, 'reject')}
                    onPreview={setPreviewSuggestion}
                  />
                ))}
              </AnimatePresence>
            )}
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card
                  key={action.id}
                  variant="default"
                  padding="md"
                  hoverable
                  onClick={action.onClick}
                  className="cursor-pointer group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="p-2 transition-colors"
                      style={{
                        backgroundColor: `${action.color}20`,
                        color: action.color,
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-[var(--text-primary)] font-medium">{action.label}</h3>
                  </div>
                  <p className="text-[var(--text-tertiary)] text-sm">{action.description}</p>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Content Suggestions
            </h2>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={fetchDashboardData}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                onClick={generateContent}
                loading={generating}
                icon={<Zap className="w-4 h-4" />}
              >
                Generate More
              </Button>
            </div>
          </div>

          {loading ? (
            <LoadingState text="Loading suggestions..." fullPage />
          ) : suggestions.length === 0 ? (
            <Card variant="default" padding="lg" className="text-center">
              <Sparkles className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                No pending suggestions
              </h3>
              <p className="text-[var(--text-secondary)] mb-6">
                Generate AI-powered content suggestions based on trending topics and influencer posts.
              </p>
              <Button variant="primary" onClick={generateContent} loading={generating}>
                Generate Content
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {suggestions.map((suggestion) => (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card variant="default" padding="md">
                      {/* Header */}
                      <div className="flex items-center flex-wrap gap-2 mb-3">
                        {suggestion.platforms.map((platform) => (
                          <PlatformBadge
                            key={platform}
                            platform={platform as SocialPlatform}
                            size="sm"
                            showLabel={false}
                          />
                        ))}
                        {suggestion.category && (
                          <CategoryBadge
                            category={suggestion.category as ContentCategory}
                            size="sm"
                          />
                        )}
                      </div>

                      {/* Hook */}
                      {suggestion.suggested_hook && (
                        <p className="text-[var(--accent-primary)] text-sm font-semibold mb-2">
                          {suggestion.suggested_hook}
                        </p>
                      )}

                      {/* Caption */}
                      <p className="text-[var(--text-secondary)] text-sm line-clamp-3 mb-3">
                        {suggestion.suggested_caption}
                      </p>

                      {/* Scores */}
                      <div className="flex items-center gap-4 mb-4 text-xs text-[var(--text-tertiary)]">
                        {suggestion.predicted_engagement_score && (
                          <span>Engagement: {suggestion.predicted_engagement_score}%</span>
                        )}
                        {suggestion.kcu_tone_match_score && (
                          <span>Tone: {suggestion.kcu_tone_match_score}%</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleSuggestionAction(suggestion.id, 'approve')}
                          className="flex-1"
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleSuggestionAction(suggestion.id, 'reject')}
                          className="flex-1"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewSuggestion(suggestion)}
                        >
                          Preview
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* Influencers Tab */}
        <TabsContent value="influencers">
          <InfluencerList
            onAddInfluencer={() => setShowAddInfluencer(true)}
            onScrapeAll={handleScrapeAll}
            showToast={showToast}
          />
        </TabsContent>

        {/* Trending Tab */}
        <TabsContent value="trending">
          <TrendingTopics
            onGenerateFromTopic={handleGenerateFromTopic}
            showToast={showToast}
          />
        </TabsContent>

        {/* Learning Milestones Tab */}
        <TabsContent value="learning">
          <LearningMilestones
            showToast={showToast}
            onRefresh={fetchDashboardData}
          />
        </TabsContent>

        {/* Brain Dump Tab */}
        <TabsContent value="brain-dump">
          <BrainDumpInput
            showToast={showToast}
            onGenerate={(output) => {
              console.log('Brain dump generated:', output);
              // Optionally refresh suggestions after generating
              fetchDashboardData();
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={async () => {
          showToast({ type: 'success', title: 'Settings saved' });
        }}
      />

      <AddInfluencerModal
        isOpen={showAddInfluencer}
        onClose={() => setShowAddInfluencer(false)}
        onAdd={handleAddInfluencer}
      />

      <ContentPreviewModal
        isOpen={!!previewSuggestion}
        onClose={() => setPreviewSuggestion(null)}
        suggestion={previewSuggestion}
        onApprove={(id) => handleSuggestionAction(id, 'approve')}
        onReject={(id) => handleSuggestionAction(id, 'reject')}
      />

      {confirmAction && (
        <ConfirmDialog
          isOpen={confirmAction.isOpen}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            await confirmAction.onConfirm();
            setConfirmAction(null);
          }}
          title={confirmAction.title}
          message={confirmAction.message}
          variant={confirmAction.variant}
        />
      )}
    </div>
  );
}

// ============================================
// Export with Toast Provider
// ============================================

export default function SocialBuilderPage() {
  return (
    <ToastProvider>
      <SocialBuilderContent />
    </ToastProvider>
  );
}
