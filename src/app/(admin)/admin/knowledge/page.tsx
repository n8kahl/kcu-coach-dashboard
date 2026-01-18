'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Stat, StatGrid } from '@/components/ui/stat';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Database,
  FileText,
  Youtube,
  Play,
  RefreshCw,
  Trash2,
  Plus,
  CheckCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Brain,
  GraduationCap,
  Webhook,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface KnowledgeStats {
  embeddingsConfigured: boolean;
  ragAvailable: boolean;
  totalChunks: number;
  totalSources: number;
  videoStats: {
    total: number;
    pending: number;
    processing: number;
    complete: number;
    failed: number;
  };
}

interface KnowledgeSource {
  id: string;
  source_type: string;
  source_id: string;
  title: string;
  url?: string;
  status: string;
  chunk_count: number;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  topics?: string[];
  transcript_status: string;
  chunk_count: number;
  created_at: string;
  category?: string;
}

interface SyncStatus {
  lastSync: string | null;
  status: 'idle' | 'syncing' | 'completed' | 'error';
  videosIndexed?: number;
  transcriptsProcessed?: number;
  error?: string;
}

interface YouTubeAPIStats {
  totalVideos: number;
  processedVideos: number;
  pendingTranscripts: number;
  categories: Record<string, number>;
}

interface ThinkificStats {
  configured: boolean;
  last_sync: string | null;
  courses_count: number;
  chapters_count: number;
  contents_count: number;
  is_syncing: boolean;
  sync_logs?: Array<{
    id: string;
    sync_type: string;
    status: string;
    courses_synced: number;
    chapters_synced: number;
    contents_synced: number;
    errors: string[];
    started_at: string;
    completed_at: string | null;
  }>;
  error?: string;
}

// ============================================
// Main Component
// ============================================

export default function KnowledgeCMSPage() {
  // Knowledge Base State
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [addingVideo, setAddingVideo] = useState(false);

  // YouTube Sync State
  const [youtubeSyncStatus, setYoutubeSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    status: 'idle',
  });
  const [youtubeStats, setYoutubeStats] = useState<YouTubeAPIStats | null>(null);

  // Thinkific State
  const [thinkificStats, setThinkificStats] = useState<ThinkificStats | null>(null);
  const [thinkificSyncing, setThinkificSyncing] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState('youtube');

  // ============================================
  // Data Fetching
  // ============================================

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch knowledge stats
      const statsRes = await fetch('/api/admin/knowledge?action=stats');
      if (statsRes.status === 403) {
        setError('Access denied. Admin privileges required.');
        return;
      }
      if (statsRes.status === 401) {
        setError('Please log in to access this page.');
        return;
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch sources and videos
      const dataRes = await fetch('/api/admin/knowledge');
      if (dataRes.ok) {
        const data = await dataRes.json();
        setSources(data.sources || []);
        setVideos(data.videos || []);
      }

      // Fetch YouTube sync status
      const ytSyncRes = await fetch('/api/youtube/sync');
      if (ytSyncRes.ok) {
        const ytData = await ytSyncRes.json();
        if (ytData.status) {
          setYoutubeSyncStatus({
            lastSync: ytData.status.last_sync_at,
            status: ytData.status.sync_status || 'idle',
            videosIndexed: ytData.status.videos_synced,
          });
        }
      }

      // Fetch YouTube video stats
      const videosRes = await fetch('/api/youtube/videos?limit=100');
      if (videosRes.ok) {
        const videosData = await videosRes.json();
        const categories: Record<string, number> = {};
        videosData.videos?.forEach((v: YouTubeVideo) => {
          if (v.category) {
            categories[v.category] = (categories[v.category] || 0) + 1;
          }
        });
        setYoutubeStats({
          totalVideos: videosData.total || 0,
          processedVideos: videosData.videos?.filter((v: YouTubeVideo) => v.transcript_status === 'completed').length || 0,
          pendingTranscripts: videosData.videos?.filter((v: YouTubeVideo) => v.transcript_status === 'pending').length || 0,
          categories,
        });
      }

      // Fetch Thinkific sync status
      const thinkificRes = await fetch('/api/admin/thinkific/sync');
      if (thinkificRes.ok) {
        const thinkificData = await thinkificRes.json();
        setThinkificStats(thinkificData);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ============================================
  // Handlers
  // ============================================

  const handleYouTubeSync = async () => {
    setYoutubeSyncStatus(prev => ({ ...prev, status: 'syncing', error: undefined }));
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
          videosIndexed: data.stats?.indexedVideos,
          transcriptsProcessed: data.stats?.transcriptsProcessed,
        });
        fetchData();
      } else {
        const err = await response.json();
        setYoutubeSyncStatus(prev => ({
          ...prev,
          status: 'error',
          error: err.error || err.details || 'Sync failed',
        }));
      }
    } catch (err) {
      setYoutubeSyncStatus(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  };

  const handleThinkificSync = async () => {
    setThinkificSyncing(true);
    try {
      const response = await fetch('/api/admin/thinkific/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'full' }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || `Sync completed: ${result.courses_synced} courses, ${result.chapters_synced} chapters, ${result.contents_synced} contents`);
        fetchData();
      } else {
        const err = await response.json();
        alert(`Sync failed: ${err.error || err.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error syncing Thinkific:', err);
      alert('Failed to sync Thinkific content');
    } finally {
      setThinkificSyncing(false);
    }
  };

  const handleProcessPending = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_pending', limit: 5 }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Processed ${result.successful} of ${result.totalProcessed} videos`);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error('Error processing pending:', err);
      alert('Failed to process videos');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddVideo = async () => {
    if (!newVideoUrl.trim()) return;

    setAddingVideo(true);
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_video', videoUrl: newVideoUrl }),
      });

      const result = await res.json();
      if (result.success) {
        alert(`Video added: ${result.videoId}`);
        setNewVideoUrl('');
        fetchData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error('Error adding video:', err);
      alert('Failed to add video');
    } finally {
      setAddingVideo(false);
    }
  };

  const handleReprocessVideo = async (videoId: string) => {
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reprocess_video', videoId }),
      });

      const result = await res.json();
      if (result.success) {
        alert(`Reprocessed: ${result.chunkCount} chunks created`);
        fetchData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error('Error reprocessing:', err);
      alert('Failed to reprocess video');
    }
  };

  const handleDeleteSource = async (sourceType: string, sourceId: string) => {
    if (!confirm('Are you sure you want to delete this knowledge source?')) return;

    try {
      const res = await fetch(
        `/api/admin/knowledge?sourceType=${sourceType}&sourceId=${sourceId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        const result = await res.json();
        alert(`Deleted ${result.deletedChunks} chunks`);
        fetchData();
      } else {
        alert('Failed to delete source');
      }
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete source');
    }
  };

  // ============================================
  // Status Badge Helper
  // ============================================

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
      case 'completed':
        return <Badge variant="success" size="sm"><CheckCircle className="w-3 h-3 mr-1" /> Complete</Badge>;
      case 'processing':
      case 'syncing':
        return <Badge variant="warning" size="sm"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
      case 'pending':
      case 'idle':
        return <Badge variant="default" size="sm"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'failed':
      case 'error':
        return <Badge variant="error" size="sm"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  // ============================================
  // Loading & Error States
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <>
        <Header
          title="Knowledge CMS"
          subtitle="Manage all learning content sources"
          breadcrumbs={[{ label: 'Admin' }, { label: 'Knowledge CMS' }]}
        />
        <PageShell>
          <PageSection>
            <Card className="border-[var(--error)] bg-[var(--error)]/10">
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{error}</p>
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">
                      Contact an administrator if you believe this is an error.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={fetchData}>
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          </PageSection>
        </PageShell>
      </>
    );
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <>
      <Header
        title="Knowledge CMS"
        subtitle="Manage all learning content sources in one place"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Knowledge CMS' }]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="default" size="sm">
              <Clock className="w-3 h-3 mr-1" />
              Auto-refresh: 30s
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={fetchData}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <PageShell>
        {/* Configuration Warning */}
        {!stats?.embeddingsConfigured && (
          <PageSection>
            <Card className="border-[var(--warning)] bg-[var(--warning)]/10">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 text-[var(--warning)]">
                  <AlertCircle className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Embeddings Not Configured</p>
                    <p className="text-sm opacity-75">Set OPENAI_API_KEY environment variable to enable RAG features.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PageSection>
        )}

        {/* Quick Stats */}
        <PageSection>
          <StatGrid columns={4}>
            <Card padding="md">
              <Stat
                label="YouTube Videos"
                value={youtubeStats?.totalVideos || stats?.videoStats.total || 0}
                icon={<Youtube className="w-4 h-4" />}
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Transcripts Ready"
                value={youtubeStats?.processedVideos || stats?.videoStats.complete || 0}
                icon={<CheckCircle className="w-4 h-4" />}
                valueColor="profit"
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Knowledge Chunks"
                value={stats?.totalChunks || 0}
                icon={<Brain className="w-4 h-4" />}
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Knowledge Sources"
                value={stats?.totalSources || 0}
                icon={<FileText className="w-4 h-4" />}
              />
            </Card>
          </StatGrid>
        </PageSection>

        {/* Tabs */}
        <PageSection>
          <Tabs defaultValue="youtube" value={activeTab} onValueChange={setActiveTab}>
            <TabsList variant="underline" className="mb-6">
              <TabsTrigger value="youtube" variant="underline">
                <Youtube className="w-4 h-4 mr-2" />
                YouTube
              </TabsTrigger>
              <TabsTrigger value="thinkific" variant="underline">
                <GraduationCap className="w-4 h-4 mr-2" />
                Thinkific
              </TabsTrigger>
              <TabsTrigger value="knowledge" variant="underline">
                <Database className="w-4 h-4 mr-2" />
                Knowledge Base
              </TabsTrigger>
              <TabsTrigger value="transcripts" variant="underline">
                <FileText className="w-4 h-4 mr-2" />
                Transcripts
              </TabsTrigger>
            </TabsList>

            {/* YouTube Tab */}
            <TabsContent value="youtube">
              <div className="space-y-6">
                {/* Sync Panel */}
                <Card variant="elevated" className="overflow-hidden">
                  <CardHeader className="border-b border-[var(--border-secondary)] bg-gradient-to-r from-red-500/10 to-transparent">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                          <Youtube className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">YouTube Channel Sync</CardTitle>
                          <p className="text-sm text-[var(--text-tertiary)]">KayCapitals Videos</p>
                        </div>
                      </div>
                      {getStatusBadge(youtubeSyncStatus.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Last Sync</span>
                      <span className="text-[var(--text-primary)]">
                        {youtubeSyncStatus.lastSync
                          ? new Date(youtubeSyncStatus.lastSync).toLocaleString()
                          : 'Never'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-tertiary)]">Videos Indexed</p>
                        <p className="text-xl font-bold text-[var(--text-primary)]">
                          {youtubeSyncStatus.videosIndexed || youtubeStats?.totalVideos || 0}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-tertiary)]">Transcripts Ready</p>
                        <p className="text-xl font-bold text-green-500">
                          {youtubeStats?.processedVideos || 0}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-tertiary)]">Pending</p>
                        <p className="text-xl font-bold text-[var(--warning)]">
                          {youtubeStats?.pendingTranscripts || 0}
                        </p>
                      </div>
                    </div>

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

                    {youtubeSyncStatus.error && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-400">{youtubeSyncStatus.error}</p>
                      </div>
                    )}

                    <Button
                      onClick={handleYouTubeSync}
                      disabled={youtubeSyncStatus.status === 'syncing'}
                      className="w-full"
                      variant="primary"
                    >
                      {youtubeSyncStatus.status === 'syncing' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Syncing Channel...
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
              </div>
            </TabsContent>

            {/* Thinkific Tab */}
            <TabsContent value="thinkific">
              <div className="space-y-6">
                {/* API Configuration Status */}
                {thinkificStats && !thinkificStats.configured && (
                  <Card className="border-[var(--warning)] bg-[var(--warning)]/10">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3 text-[var(--warning)]">
                        <AlertCircle className="w-5 h-5" />
                        <div>
                          <p className="font-medium">Thinkific API Not Configured</p>
                          <p className="text-sm opacity-75">
                            {thinkificStats.error || 'Set THINKIFIC_API_KEY and THINKIFIC_SUBDOMAIN environment variables.'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sync Panel */}
                <Card variant="elevated" className="overflow-hidden">
                  <CardHeader className="border-b border-[var(--border-secondary)] bg-gradient-to-r from-indigo-500/10 to-transparent">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                          <GraduationCap className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Thinkific LMS Content</CardTitle>
                          <p className="text-sm text-[var(--text-tertiary)]">Courses, Chapters & Lessons</p>
                        </div>
                      </div>
                      {thinkificStats?.configured ? (
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          API Configured
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Not Configured
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Last Sync</span>
                      <span className="text-[var(--text-primary)]">
                        {thinkificStats?.last_sync
                          ? new Date(thinkificStats.last_sync).toLocaleString()
                          : 'Never'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-tertiary)]">Courses</p>
                        <p className="text-xl font-bold text-[var(--text-primary)]">
                          {thinkificStats?.courses_count || 0}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-tertiary)]">Chapters</p>
                        <p className="text-xl font-bold text-[var(--text-primary)]">
                          {thinkificStats?.chapters_count || 0}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-tertiary)]">Lessons</p>
                        <p className="text-xl font-bold text-[var(--text-primary)]">
                          {thinkificStats?.contents_count || 0}
                        </p>
                      </div>
                    </div>

                    {/* Webhook Status */}
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2">
                      <Webhook className="w-4 h-4 text-green-500" />
                      <p className="text-sm text-green-400">Webhooks Active - Progress syncs automatically</p>
                    </div>

                    {/* Sync Logs */}
                    {thinkificStats?.sync_logs && thinkificStats.sync_logs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-[var(--text-secondary)]">Recent Syncs</p>
                        <div className="space-y-1">
                          {thinkificStats.sync_logs.slice(0, 3).map((log) => (
                            <div
                              key={log.id}
                              className="flex items-center justify-between text-xs p-2 rounded bg-[var(--bg-secondary)]"
                            >
                              <div className="flex items-center gap-2">
                                {log.status === 'completed' ? (
                                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                                ) : log.status === 'running' ? (
                                  <Loader2 className="w-3 h-3 text-[var(--warning)] animate-spin" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-[var(--error)]" />
                                )}
                                <span className="text-[var(--text-tertiary)]">
                                  {new Date(log.started_at).toLocaleDateString()}
                                </span>
                              </div>
                              <span className="text-[var(--text-primary)]">
                                {log.courses_synced}c / {log.chapters_synced}ch / {log.contents_synced}l
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleThinkificSync}
                      disabled={thinkificSyncing || !thinkificStats?.configured}
                      className="w-full"
                      variant="primary"
                    >
                      {thinkificSyncing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Syncing Thinkific Content...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync All Courses
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-[var(--text-muted)] text-center">
                      Fetches all courses, chapters, and lessons from Thinkific API
                    </p>
                  </CardContent>
                </Card>

                {/* Webhook Info Card */}
                <Card>
                  <CardHeader title="Webhook Events" />
                  <CardContent>
                    <div className="text-sm text-[var(--text-tertiary)] space-y-1">
                      <p className="text-[var(--text-secondary)] mb-2">Configured webhook events for real-time updates:</p>
                      <ul className="list-disc list-inside ml-2 space-y-0.5">
                        <li>user.signup - Links Thinkific user to KCU</li>
                        <li>enrollment.created - Records enrollment, awards 50 XP</li>
                        <li>enrollment.progress - Updates progress percentage</li>
                        <li>lesson.completed - Awards 25-100 XP based on content type</li>
                        <li>enrollment.completed - Awards 500 XP, creates achievement</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Knowledge Base Tab */}
            <TabsContent value="knowledge">
              <div className="space-y-6">
                {/* Add Content */}
                <Card>
                  <CardHeader title="Add YouTube Video" />
                  <CardContent>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Input
                          placeholder="YouTube URL or Video ID..."
                          value={newVideoUrl}
                          onChange={(e) => setNewVideoUrl(e.target.value)}
                          leftIcon={<Youtube className="w-4 h-4" />}
                        />
                      </div>
                      <Button
                        variant="primary"
                        icon={addingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        onClick={handleAddVideo}
                        disabled={addingVideo || !newVideoUrl.trim()}
                      >
                        Add Video
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Knowledge Sources Table */}
                <Card>
                  <CardHeader
                    title="Knowledge Sources"
                    action={
                      <Badge variant="default" size="sm">
                        <Brain className="w-3 h-3 mr-1" />
                        {stats?.totalChunks || 0} chunks
                      </Badge>
                    }
                  />
                  <Table>
                    <TableHeader>
                      <TableRow hoverable={false}>
                        <TableHead>Source</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Chunks</TableHead>
                        <TableHead>Processed</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sources.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="text-center py-8 text-[var(--text-tertiary)]">
                              No knowledge sources yet. Process videos or ingest documents to populate.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        sources.map((source) => (
                          <TableRow key={source.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-[var(--text-primary)] max-w-xs truncate">
                                  {source.title}
                                </p>
                                <p className="text-xs text-[var(--text-tertiary)]">
                                  {source.source_id}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="default" size="sm">
                                {source.source_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(source.status)}
                              {source.error_message && (
                                <p className="text-xs text-[var(--error)] mt-1 max-w-xs truncate">
                                  {source.error_message}
                                </p>
                              )}
                            </TableCell>
                            <TableCell mono>{source.chunk_count}</TableCell>
                            <TableCell>
                              <span className="text-xs text-[var(--text-tertiary)]">
                                {source.processed_at ? formatDateTime(source.processed_at) : '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <button
                                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)]"
                                onClick={() => handleDeleteSource(source.source_type, source.source_id)}
                                title="Delete source"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            </TabsContent>

            {/* Transcripts Tab */}
            <TabsContent value="transcripts">
              <div className="space-y-6">
                {/* Processing Controls */}
                <Card>
                  <CardHeader title="Transcript Processing" />
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className="text-[var(--text-tertiary)]">Pending: </span>
                          <span className="font-medium text-[var(--warning)]">{stats?.videoStats.pending || 0}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Processing: </span>
                          <span className="font-medium text-[var(--text-primary)]">{stats?.videoStats.processing || 0}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Complete: </span>
                          <span className="font-medium text-green-500">{stats?.videoStats.complete || 0}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Failed: </span>
                          <span className="font-medium text-[var(--error)]">{stats?.videoStats.failed || 0}</span>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        icon={processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        onClick={handleProcessPending}
                        disabled={processing || !stats?.embeddingsConfigured}
                      >
                        Process Pending (5)
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Videos Table */}
                <Card>
                  <CardHeader
                    title="YouTube Videos"
                    action={
                      <Badge variant="default" size="sm">
                        {videos.length} videos
                      </Badge>
                    }
                  />
                  <Table>
                    <TableHeader>
                      <TableRow hoverable={false}>
                        <TableHead>Video</TableHead>
                        <TableHead>Topics</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Chunks</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {videos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="text-center py-8 text-[var(--text-tertiary)]">
                              No videos added yet. Add a YouTube URL or sync the channel.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        videos.map((video) => (
                          <TableRow key={video.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-red-500/20 rounded flex items-center justify-center">
                                  <Youtube className="w-4 h-4 text-red-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-[var(--text-primary)] max-w-xs truncate">
                                    {video.title}
                                  </p>
                                  <p className="text-xs text-[var(--text-tertiary)]">
                                    {video.video_id}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {video.topics?.map((topic, i) => (
                                <Badge key={i} variant="default" size="sm" className="mr-1">
                                  {topic}
                                </Badge>
                              )) || <span className="text-[var(--text-tertiary)]">-</span>}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(video.transcript_status)}
                            </TableCell>
                            <TableCell mono>{video.chunk_count}</TableCell>
                            <TableCell>
                              <span className="text-xs text-[var(--text-tertiary)]">
                                {formatDateTime(video.created_at)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <button
                                  className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]"
                                  onClick={() => handleReprocessVideo(video.video_id)}
                                  title="Reprocess transcript"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <button
                                  className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)]"
                                  onClick={() => handleDeleteSource('transcript', video.video_id)}
                                  title="Delete chunks"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </PageSection>
      </PageShell>
    </>
  );
}
