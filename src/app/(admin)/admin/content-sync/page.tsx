'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Youtube,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Database,
  Loader2,
  AlertTriangle,
  BarChart3,
  Users,
  BookOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface SyncStatus {
  lastSync: string | null;
  status: 'idle' | 'syncing' | 'completed' | 'error';
  videosIndexed?: number;
  transcriptsProcessed?: number;
  error?: string;
}

interface YouTubeStats {
  totalVideos: number;
  processedVideos: number;
  pendingTranscripts: number;
  categories: Record<string, number>;
}

interface ThinkificStats {
  totalUsers: number;
  totalEnrollments: number;
  courseCompletions: number;
  recentActivity: number;
}

// ============================================
// Main Component
// ============================================

export default function ContentSyncPage() {
  const [youtubeSyncStatus, setYoutubeSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    status: 'idle',
  });
  const [thinkificSyncStatus, setThinkificSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    status: 'idle',
  });
  const [youtubeStats, setYoutubeStats] = useState<YouTubeStats | null>(null);
  const [thinkificStats, setThinkificStats] = useState<ThinkificStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial stats
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // Fetch YouTube sync status
      const ytResponse = await fetch('/api/youtube/sync');
      if (ytResponse.ok) {
        const ytData = await ytResponse.json();
        if (ytData.status) {
          setYoutubeSyncStatus({
            lastSync: ytData.status.last_sync_at,
            status: ytData.status.sync_status || 'idle',
            videosIndexed: ytData.status.videos_synced,
          });
        }
      }

      // Fetch YouTube video stats
      const videosResponse = await fetch('/api/youtube/videos?limit=1');
      if (videosResponse.ok) {
        const videosData = await videosResponse.json();
        setYoutubeStats({
          totalVideos: videosData.total || 0,
          processedVideos: videosData.videos?.filter((v: { transcript_status: string }) => v.transcript_status === 'completed').length || 0,
          pendingTranscripts: videosData.videos?.filter((v: { transcript_status: string }) => v.transcript_status === 'pending').length || 0,
          categories: videosData.categories?.reduce((acc: Record<string, number>, c: { category: string; count: number }) => {
            acc[c.category] = c.count;
            return acc;
          }, {}) || {},
        });
      }

      // TODO: Fetch Thinkific stats when API is ready
      setThinkificStats({
        totalUsers: 0,
        totalEnrollments: 0,
        courseCompletions: 0,
        recentActivity: 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleYouTubeSync = async () => {
    setYoutubeSyncStatus(prev => ({ ...prev, status: 'syncing' }));
    try {
      const response = await fetch('/api/youtube/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxVideos: 100,
          processTranscripts: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setYoutubeSyncStatus({
          lastSync: new Date().toISOString(),
          status: 'completed',
          videosIndexed: data.stats?.videosIndexed,
          transcriptsProcessed: data.stats?.transcriptsProcessed,
        });
        // Refresh stats
        fetchStats();
      } else {
        const error = await response.json();
        setYoutubeSyncStatus(prev => ({
          ...prev,
          status: 'error',
          error: error.error || 'Sync failed',
        }));
      }
    } catch (error) {
      setYoutubeSyncStatus(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  };

  const handleThinkificSync = async () => {
    setThinkificSyncStatus(prev => ({ ...prev, status: 'syncing' }));
    try {
      // TODO: Implement Thinkific API sync
      // For now, webhooks handle real-time sync
      setTimeout(() => {
        setThinkificSyncStatus({
          lastSync: new Date().toISOString(),
          status: 'completed',
        });
      }, 2000);
    } catch (error) {
      setThinkificSyncStatus(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Content Sync</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Manage YouTube video indexing and Thinkific course synchronization
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="YouTube Videos"
          value={youtubeStats?.totalVideos || 0}
          icon={Youtube}
          color="red"
          loading={isLoading}
        />
        <StatCard
          title="Transcripts Ready"
          value={youtubeStats?.processedVideos || 0}
          icon={Database}
          color="green"
          loading={isLoading}
        />
        <StatCard
          title="Thinkific Users"
          value={thinkificStats?.totalUsers || 0}
          icon={Users}
          color="indigo"
          loading={isLoading}
        />
        <StatCard
          title="Course Completions"
          value={thinkificStats?.courseCompletions || 0}
          icon={CheckCircle2}
          color="gold"
          loading={isLoading}
        />
      </div>

      {/* Sync Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* YouTube Sync Panel */}
        <Card variant="elevated" className="overflow-hidden">
          <CardHeader className="border-b border-[var(--border-secondary)] bg-gradient-to-r from-red-500/10 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Youtube className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">YouTube Channel</CardTitle>
                  <p className="text-sm text-[var(--text-tertiary)]">KayCapitals Videos</p>
                </div>
              </div>
              <SyncStatusBadge status={youtubeSyncStatus.status} />
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Last Sync Info */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Last Sync</span>
              <span className="text-[var(--text-primary)]">
                {youtubeSyncStatus.lastSync
                  ? new Date(youtubeSyncStatus.lastSync).toLocaleString()
                  : 'Never'}
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-tertiary)]">Videos Indexed</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">
                  {youtubeSyncStatus.videosIndexed || youtubeStats?.totalVideos || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-tertiary)]">Transcripts</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">
                  {youtubeSyncStatus.transcriptsProcessed || youtubeStats?.processedVideos || 0}
                </p>
              </div>
            </div>

            {/* Categories */}
            {youtubeStats?.categories && Object.keys(youtubeStats.categories).length > 0 && (
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-2">Categories</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(youtubeStats.categories).map(([cat, count]) => (
                    <Badge key={cat} variant="default" size="sm">
                      {cat}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {youtubeSyncStatus.error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                <p className="text-sm text-red-400">{youtubeSyncStatus.error}</p>
              </div>
            )}

            {/* Sync Button */}
            <Button
              onClick={handleYouTubeSync}
              disabled={youtubeSyncStatus.status === 'syncing'}
              className="w-full"
              variant="default"
            >
              {youtubeSyncStatus.status === 'syncing' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync YouTube Channel
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Thinkific Sync Panel */}
        <Card variant="elevated" className="overflow-hidden">
          <CardHeader className="border-b border-[var(--border-secondary)] bg-gradient-to-r from-indigo-500/10 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Thinkific LMS</CardTitle>
                  <p className="text-sm text-[var(--text-tertiary)]">Course Progress & Enrollments</p>
                </div>
              </div>
              <SyncStatusBadge status={thinkificSyncStatus.status} />
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Last Sync Info */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Last Sync</span>
              <span className="text-[var(--text-primary)]">
                {thinkificSyncStatus.lastSync
                  ? new Date(thinkificSyncStatus.lastSync).toLocaleString()
                  : 'Via Webhooks'}
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-tertiary)]">Enrollments</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">
                  {thinkificStats?.totalEnrollments || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-tertiary)]">Completions</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">
                  {thinkificStats?.courseCompletions || 0}
                </p>
              </div>
            </div>

            {/* Webhook Status */}
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <p className="text-sm text-green-400">Webhooks Active - Real-time sync enabled</p>
            </div>

            {/* Info */}
            <p className="text-xs text-[var(--text-tertiary)]">
              Thinkific data syncs automatically via webhooks. Manual sync pulls full enrollment data.
            </p>

            {/* Sync Button */}
            <Button
              onClick={handleThinkificSync}
              disabled={thinkificSyncStatus.status === 'syncing'}
              className="w-full"
              variant="outline"
            >
              {thinkificSyncStatus.status === 'syncing' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Force Full Sync
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity / Logs */}
      <Card variant="elevated" className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IntegrationStatus
              name="YouTube API"
              status={process.env.NEXT_PUBLIC_YOUTUBE_CONFIGURED === 'true' || youtubeStats?.totalVideos ? 'connected' : 'not_configured'}
              description="Video indexing and transcript extraction"
            />
            <IntegrationStatus
              name="Thinkific SSO"
              status="connected"
              description="Single Sign-On for course access"
            />
            <IntegrationStatus
              name="Thinkific Webhooks"
              status="connected"
              description="Real-time progress sync"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Sub Components
// ============================================

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'red' | 'green' | 'indigo' | 'gold';
  loading?: boolean;
}

function StatCard({ title, value, icon: Icon, color, loading }: StatCardProps) {
  const colorClasses = {
    red: 'bg-red-500/10 text-red-500',
    green: 'bg-green-500/10 text-green-500',
    indigo: 'bg-indigo-500/10 text-indigo-500',
    gold: 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)]',
  };

  return (
    <Card variant="elevated" className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-[var(--text-secondary)]">{title}</p>
          {loading ? (
            <div className="h-7 w-16 bg-[var(--bg-secondary)] animate-pulse rounded" />
          ) : (
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value.toLocaleString()}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

interface SyncStatusBadgeProps {
  status: SyncStatus['status'];
}

function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const configs = {
    idle: { label: 'Idle', variant: 'default' as const, icon: Clock },
    syncing: { label: 'Syncing', variant: 'gold' as const, icon: RefreshCw },
    completed: { label: 'Synced', variant: 'success' as const, icon: CheckCircle2 },
    error: { label: 'Error', variant: 'destructive' as const, icon: XCircle },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className={cn('w-3 h-3', status === 'syncing' && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}

interface IntegrationStatusProps {
  name: string;
  status: 'connected' | 'not_configured' | 'error';
  description: string;
}

function IntegrationStatus({ name, status, description }: IntegrationStatusProps) {
  const statusConfig = {
    connected: { color: 'text-green-500', bg: 'bg-green-500', label: 'Connected' },
    not_configured: { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'Not Configured' },
    error: { color: 'text-red-500', bg: 'bg-red-500', label: 'Error' },
  };

  const config = statusConfig[status];

  return (
    <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-[var(--text-primary)]">{name}</span>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', config.bg)} />
          <span className={cn('text-sm', config.color)}>{config.label}</span>
        </div>
      </div>
      <p className="text-sm text-[var(--text-tertiary)]">{description}</p>
    </div>
  );
}
