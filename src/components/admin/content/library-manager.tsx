'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { getRelativeTime } from '@/lib/utils';
import {
  Youtube,
  Cloud,
  Play,
  RefreshCw,
  Trash2,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  Search,
  GripVertical,
  ExternalLink,
} from 'lucide-react';

// ============================================
// Types
// ============================================

export interface LibraryVideo {
  id: string;
  type: 'youtube' | 'cloudflare';
  videoId: string; // YouTube video_id or Cloudflare uid
  title: string;
  description?: string;
  thumbnailUrl?: string;
  duration?: number; // in seconds
  status: 'pending' | 'processing' | 'ready' | 'failed';
  transcriptStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptText?: string;
  chunkCount?: number;
  topics?: string[];
  createdAt: string;
  url?: string; // YouTube URL
}

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

interface LibraryManagerProps {
  onSelectVideo?: (video: LibraryVideo) => void;
  selectable?: boolean;
  selectedVideoId?: string;
}

// ============================================
// Main Component
// ============================================

export function LibraryManager({
  onSelectVideo,
  selectable = false,
  selectedVideoId,
}: LibraryManagerProps) {
  const { showToast, updateToast } = useToast();

  // State
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // YouTube State
  const [youtubeSyncStatus, setYoutubeSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    status: 'idle',
  });
  const [youtubeStats, setYoutubeStats] = useState<YouTubeStats | null>(null);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [addingVideo, setAddingVideo] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch YouTube videos
      const ytVideosRes = await fetch('/api/youtube/videos?limit=100');
      if (ytVideosRes.ok) {
        const ytData = await ytVideosRes.json();
        const ytVideos: LibraryVideo[] = (ytData.videos || []).map((v: {
          id: string;
          video_id: string;
          title: string;
          description?: string;
          thumbnail_url?: string;
          duration_seconds?: number;
          transcript_status: string;
          transcript_text?: string;
          chunk_count?: number;
          topics?: string[];
          created_at: string;
        }) => ({
          id: v.id,
          type: 'youtube' as const,
          videoId: v.video_id,
          title: v.title,
          description: v.description,
          thumbnailUrl: v.thumbnail_url || `https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`,
          duration: v.duration_seconds,
          status: v.transcript_status === 'completed' ? 'ready' : v.transcript_status === 'pending' ? 'pending' : v.transcript_status === 'processing' ? 'processing' : 'failed',
          transcriptStatus: v.transcript_status as LibraryVideo['transcriptStatus'],
          transcriptText: v.transcript_text,
          chunkCount: v.chunk_count,
          topics: v.topics,
          createdAt: v.created_at,
          url: `https://www.youtube.com/watch?v=${v.video_id}`,
        }));

        // Calculate YouTube stats
        const categories: Record<string, number> = {};
        ytData.videos?.forEach((v: { category?: string }) => {
          if (v.category) {
            categories[v.category] = (categories[v.category] || 0) + 1;
          }
        });
        setYoutubeStats({
          totalVideos: ytData.total || 0,
          processedVideos: ytVideos.filter(v => v.transcriptStatus === 'completed').length,
          pendingTranscripts: ytVideos.filter(v => v.transcriptStatus === 'pending').length,
          categories,
        });

        setVideos(ytVideos);
      }

      // Fetch YouTube sync status
      const ytSyncRes = await fetch('/api/youtube/sync');
      if (ytSyncRes.ok) {
        const ytSyncData = await ytSyncRes.json();
        if (ytSyncData.status) {
          setYoutubeSyncStatus({
            lastSync: ytSyncData.status.last_sync_at,
            status: ytSyncData.status.sync_status || 'idle',
            videosIndexed: ytSyncData.status.videos_synced,
          });
        }
      }

      // TODO: Fetch Cloudflare videos from course_lessons where video_uid is set
      // This would aggregate all uploaded videos for reuse

    } catch (err) {
      console.error('Error fetching library data:', err);
      setError('Failed to load video library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // Handlers
  // ============================================

  const handleYouTubeSync = async () => {
    setYoutubeSyncStatus(prev => ({ ...prev, status: 'syncing', error: undefined }));
    const toastId = showToast({
      type: 'loading',
      title: 'Syncing YouTube',
      message: 'Fetching videos and transcripts...',
      persistent: true,
    });

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
        updateToast(toastId, {
          type: 'success',
          title: 'YouTube Sync Complete',
          message: `${data.stats?.indexedVideos || 0} videos indexed`,
        });
        fetchData();
      } else {
        const err = await response.json();
        setYoutubeSyncStatus(prev => ({
          ...prev,
          status: 'error',
          error: err.error || 'Sync failed',
        }));
        updateToast(toastId, {
          type: 'error',
          title: 'YouTube Sync Failed',
          message: err.error || 'Sync failed',
        });
      }
    } catch (err) {
      setYoutubeSyncStatus(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
      updateToast(toastId, {
        type: 'error',
        title: 'YouTube Sync Failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
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
        showToast({
          type: 'success',
          title: 'Video Added',
          message: `Video ID: ${result.videoId}`,
        });
        setNewVideoUrl('');
        fetchData();
      } else {
        showToast({
          type: 'error',
          title: 'Failed to Add Video',
          message: result.error,
        });
      }
    } catch (err) {
      console.error('Error adding video:', err);
      showToast({
        type: 'error',
        title: 'Failed to Add Video',
        message: 'An unexpected error occurred',
      });
    } finally {
      setAddingVideo(false);
    }
  };

  const handleProcessTranscript = async (videoId: string) => {
    const toastId = showToast({
      type: 'loading',
      title: 'Processing Transcript',
      message: 'Extracting and embedding...',
      persistent: true,
    });

    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reprocess_video', videoId }),
      });

      const result = await res.json();
      if (result.success) {
        updateToast(toastId, {
          type: 'success',
          title: 'Transcript Processed',
          message: `${result.chunkCount} chunks created`,
        });
        fetchData();
      } else {
        updateToast(toastId, {
          type: 'error',
          title: 'Processing Failed',
          message: result.error,
        });
      }
    } catch (err) {
      console.error('Error processing transcript:', err);
      updateToast(toastId, {
        type: 'error',
        title: 'Processing Failed',
        message: 'Failed to process transcript',
      });
    }
  };

  const handleDeleteVideo = async (video: LibraryVideo) => {
    if (!confirm(`Delete "${video.title}" from the library?`)) return;

    try {
      const res = await fetch(
        `/api/admin/knowledge?sourceType=transcript&sourceId=${video.videoId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        showToast({
          type: 'success',
          title: 'Video Deleted',
          message: 'Video removed from library',
        });
        fetchData();
      } else {
        showToast({
          type: 'error',
          title: 'Delete Failed',
          message: 'Failed to delete video',
        });
      }
    } catch (err) {
      console.error('Error deleting video:', err);
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete video',
      });
    }
  };

  // ============================================
  // Filtering
  // ============================================

  const filteredVideos = videos.filter(video => {
    // Tab filter
    if (activeTab === 'youtube' && video.type !== 'youtube') return false;
    if (activeTab === 'cloudflare' && video.type !== 'cloudflare') return false;
    if (activeTab === 'pending' && video.status !== 'pending') return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        video.title.toLowerCase().includes(query) ||
        video.videoId.toLowerCase().includes(query) ||
        video.topics?.some(t => t.toLowerCase().includes(query))
      );
    }

    return true;
  });

  // ============================================
  // Status Badge Helper
  // ============================================

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
      case 'completed':
        return <Badge variant="success" size="sm"><CheckCircle className="w-3 h-3 mr-1" /> Ready</Badge>;
      case 'processing':
        return <Badge variant="warning" size="sm"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
      case 'pending':
        return <Badge variant="default" size="sm"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'failed':
        return <Badge variant="error" size="sm"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-[var(--error)] bg-[var(--error)]/10">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-[var(--error)]" />
            <div>
              <p className="font-medium text-[var(--text-primary)]">{error}</p>
              <Button variant="secondary" size="sm" onClick={fetchData} className="mt-4">
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
                <p className="text-sm text-[var(--text-tertiary)]">
                  {youtubeSyncStatus.lastSync
                    ? `Last sync: ${getRelativeTime(youtubeSyncStatus.lastSync)}`
                    : 'Never synced'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(youtubeSyncStatus.status)}
              <Button
                onClick={handleYouTubeSync}
                disabled={youtubeSyncStatus.status === 'syncing'}
                variant="primary"
                size="sm"
              >
                {youtubeSyncStatus.status === 'syncing' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Channel
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
              <p className="text-xs text-[var(--text-tertiary)]">Total Videos</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {youtubeStats?.totalVideos || 0}
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

          {/* Add Video URL */}
          <div className="flex gap-2">
            <Input
              placeholder="Add YouTube URL or Video ID..."
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
              leftIcon={<Youtube className="w-4 h-4" />}
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={handleAddVideo}
              disabled={addingVideo || !newVideoUrl.trim()}
            >
              {addingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Video Library */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Video Library</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="all">
          <div className="px-4 border-b border-[var(--border-primary)]">
            <TabsList variant="underline">
              <TabsTrigger value="all" variant="underline">
                All ({videos.length})
              </TabsTrigger>
              <TabsTrigger value="youtube" variant="underline">
                <Youtube className="w-4 h-4 mr-1" />
                YouTube ({videos.filter(v => v.type === 'youtube').length})
              </TabsTrigger>
              <TabsTrigger value="cloudflare" variant="underline">
                <Cloud className="w-4 h-4 mr-1" />
                Uploaded ({videos.filter(v => v.type === 'cloudflare').length})
              </TabsTrigger>
              <TabsTrigger value="pending" variant="underline">
                <Clock className="w-4 h-4 mr-1" />
                Pending ({videos.filter(v => v.status === 'pending').length})
              </TabsTrigger>
            </TabsList>
          </div>

          <CardContent className="p-0">
            <TabsContent value={activeTab} className="mt-0">
              {filteredVideos.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-tertiary)]">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No videos found</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-primary)]">
                  {filteredVideos.map((video) => (
                    <div
                      key={video.id}
                      className={cn(
                        'flex items-center gap-4 p-4 transition-colors',
                        selectable && 'cursor-pointer hover:bg-[var(--bg-tertiary)]',
                        selectedVideoId === video.id && 'bg-[var(--accent-primary)]/10 border-l-2 border-l-[var(--accent-primary)]'
                      )}
                      onClick={() => selectable && onSelectVideo?.(video)}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0">
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {video.type === 'youtube' ? (
                              <Youtube className="w-8 h-8 text-red-500" />
                            ) : (
                              <Cloud className="w-8 h-8 text-[var(--accent-primary)]" />
                            )}
                          </div>
                        )}
                        {video.duration && (
                          <span className="absolute bottom-1 right-1 px-1 py-0.5 text-xs bg-black/80 text-white rounded">
                            {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-[var(--text-primary)] line-clamp-1">
                              {video.title}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                              {video.videoId}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {getStatusBadge(video.status)}
                            <Badge variant="default" size="sm">
                              {video.type === 'youtube' ? (
                                <Youtube className="w-3 h-3" />
                              ) : (
                                <Cloud className="w-3 h-3" />
                              )}
                            </Badge>
                          </div>
                        </div>

                        {/* Topics */}
                        {video.topics && video.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {video.topics.slice(0, 3).map((topic, i) => (
                              <Badge key={i} variant="default" size="sm">
                                {topic}
                              </Badge>
                            ))}
                            {video.topics.length > 3 && (
                              <Badge variant="default" size="sm">
                                +{video.topics.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
                          {video.chunkCount !== undefined && (
                            <span>{video.chunkCount} chunks</span>
                          )}
                          <span>{getRelativeTime(video.createdAt)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      {!selectable && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {video.url && (
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            className="p-2 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcessTranscript(video.videoId);
                            }}
                            title="Process transcript"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 text-[var(--text-tertiary)] hover:text-[var(--error)]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVideo(video);
                            }}
                            title="Delete video"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Selection Indicator */}
                      {selectable && (
                        <div className={cn(
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          selectedVideoId === video.id
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                            : 'border-[var(--border-secondary)]'
                        )}>
                          {selectedVideoId === video.id && (
                            <CheckCircle className="w-4 h-4 text-black" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}

// ============================================
// Video Picker Modal
// ============================================

export function VideoPickerModal({
  isOpen,
  onClose,
  onSelect,
  selectedVideoId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (video: LibraryVideo) => void;
  selectedVideoId?: string;
}) {
  const [selected, setSelected] = useState<LibraryVideo | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg w-full max-w-4xl max-h-[80vh] mx-4 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Select from Library</h2>
            <p className="text-xs text-[var(--text-tertiary)]">Choose an existing video to use</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <LibraryManager
            selectable
            selectedVideoId={selected?.id || selectedVideoId}
            onSelectVideo={setSelected}
          />
        </div>

        <div className="flex gap-2 p-4 border-t border-[var(--border-primary)]">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (selected) {
                onSelect(selected);
                onClose();
              }
            }}
            disabled={!selected}
            className="flex-1"
          >
            Use Selected Video
          </Button>
        </div>
      </div>
    </div>
  );
}
