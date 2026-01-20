'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Play,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Youtube,
  Cloud,
  ExternalLink,
} from 'lucide-react';
import type { VideoStatus } from '@/types/learning';

// ============================================
// Types
// ============================================

interface PreviewPlayerProps {
  /** Cloudflare Stream video UID */
  videoUid?: string | null;
  /** YouTube or external video URL */
  videoUrl?: string | null;
  /** Current video status from database */
  videoStatus?: VideoStatus | null;
  /** Video duration in seconds */
  videoDurationSeconds?: number | null;
  /** Thumbnail URL (optional) */
  thumbnailUrl?: string | null;
  /** Callback when status changes (e.g., after polling) */
  onStatusChange?: (status: VideoStatus, metadata?: VideoMetadata) => void;
  /** Additional class names */
  className?: string;
}

interface VideoMetadata {
  duration?: number;
  thumbnailUrl?: string;
  playbackHls?: string;
  playbackDash?: string;
}

interface CloudflareStatusResponse {
  success: boolean;
  result?: {
    uid: string;
    readyToStream: boolean;
    status: {
      state: string;
      pctComplete?: string;
    };
    duration?: number;
    thumbnail?: string;
    playback?: {
      hls: string;
      dash: string;
    };
  };
  error?: string;
}

// ============================================
// Environment Check
// ============================================

function getCloudflareStreamDomain(): string | null {
  const domain = process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_DOMAIN;
  if (!domain) {
    return null;
  }
  return domain;
}

// ============================================
// YouTube URL Parser
// ============================================

function extractYouTubeVideoId(url: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// ============================================
// Main Component
// ============================================

export function PreviewPlayer({
  videoUid,
  videoUrl,
  videoStatus = 'pending',
  videoDurationSeconds,
  thumbnailUrl,
  onStatusChange,
  className,
}: PreviewPlayerProps) {
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Determine video type
  const isCloudflare = Boolean(videoUid);
  const isYouTube = Boolean(videoUrl) && !videoUid;
  const hasVideo = isCloudflare || isYouTube;

  // Get Cloudflare domain
  const streamDomain = getCloudflareStreamDomain();
  const missingEnvVar = isCloudflare && !streamDomain;

  // Extract YouTube video ID if applicable
  const youtubeVideoId = isYouTube && videoUrl ? extractYouTubeVideoId(videoUrl) : null;

  // ============================================
  // Status Polling
  // ============================================

  const checkVideoStatus = useCallback(async () => {
    if (!videoUid) return;

    setPolling(true);
    setPollError(null);

    try {
      const response = await fetch(`/api/admin/content/video/status?uid=${videoUid}`);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to check status: ${response.status}`);
      }

      const data: CloudflareStatusResponse = await response.json();

      if (data.success && data.result) {
        const cfStatus = data.result.status.state;
        let newStatus: VideoStatus = 'pending';

        if (data.result.readyToStream || cfStatus === 'ready') {
          newStatus = 'ready';
        } else if (['downloading', 'queued', 'inprogress'].includes(cfStatus)) {
          newStatus = 'processing';
        } else if (cfStatus === 'error') {
          newStatus = 'error';
        }

        onStatusChange?.(newStatus, {
          duration: data.result.duration,
          thumbnailUrl: data.result.thumbnail,
          playbackHls: data.result.playback?.hls,
          playbackDash: data.result.playback?.dash,
        });

        setLastChecked(new Date());
      }
    } catch (err) {
      console.error('Error checking video status:', err);
      setPollError(err instanceof Error ? err.message : 'Failed to check status');
    } finally {
      setPolling(false);
    }
  }, [videoUid, onStatusChange]);

  // Auto-poll for processing videos
  useEffect(() => {
    if (videoStatus === 'processing' && videoUid) {
      const interval = setInterval(() => {
        checkVideoStatus();
      }, 15000); // Check every 15 seconds

      return () => clearInterval(interval);
    }
  }, [videoStatus, videoUid, checkVideoStatus]);

  // ============================================
  // Format Duration
  // ============================================

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // ============================================
  // Render: No Video
  // ============================================

  if (!hasVideo) {
    return (
      <div className={cn(
        'aspect-video bg-[var(--bg-tertiary)] rounded-lg flex flex-col items-center justify-center',
        className
      )}>
        <Play className="w-12 h-12 text-[var(--text-tertiary)] mb-2" />
        <p className="text-sm text-[var(--text-tertiary)]">No video selected</p>
      </div>
    );
  }

  // ============================================
  // Render: Missing Environment Variable
  // ============================================

  if (missingEnvVar) {
    return (
      <div className={cn(
        'aspect-video bg-red-500/10 border-2 border-dashed border-red-500/50 rounded-lg flex flex-col items-center justify-center p-6',
        className
      )}>
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <p className="text-sm font-medium text-red-400 text-center mb-2">
          Configuration Error
        </p>
        <p className="text-xs text-red-400/80 text-center max-w-sm">
          <code className="bg-red-500/20 px-1 py-0.5 rounded">NEXT_PUBLIC_CLOUDFLARE_STREAM_DOMAIN</code> environment variable is not set. Video playback is unavailable.
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mt-4">
          Video UID: {videoUid}
        </p>
      </div>
    );
  }

  // ============================================
  // Render: YouTube Video
  // ============================================

  if (isYouTube && youtubeVideoId) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeVideoId}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Youtube className="w-4 h-4 text-red-500" />
            <span className="text-[var(--text-tertiary)]">YouTube Video</span>
            {videoDurationSeconds && (
              <span className="text-[var(--text-tertiary)]">
                • {formatDuration(videoDurationSeconds)}
              </span>
            )}
          </div>
          <a
            href={videoUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </a>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Cloudflare Video - Processing/Pending
  // ============================================

  if (isCloudflare && videoStatus !== 'ready') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className={cn(
          'aspect-video rounded-lg flex flex-col items-center justify-center relative overflow-hidden',
          videoStatus === 'error'
            ? 'bg-red-500/10 border border-red-500/30'
            : 'bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]'
        )}>
          {/* Thumbnail background if available */}
          {thumbnailUrl && (
            <div className="absolute inset-0">
              <img
                src={thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-full object-cover opacity-30"
              />
            </div>
          )}

          <div className="relative z-10 text-center space-y-3">
            {videoStatus === 'processing' ? (
              <>
                <Loader2 className="w-12 h-12 text-[var(--accent-primary)] animate-spin mx-auto" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Video Processing
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Cloudflare is processing your video. This may take a few minutes.
                  </p>
                </div>
              </>
            ) : videoStatus === 'error' ? (
              <>
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-red-400">
                    Processing Failed
                  </p>
                  <p className="text-xs text-red-400/80 mt-1">
                    There was an error processing this video.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Clock className="w-12 h-12 text-[var(--text-tertiary)] mx-auto" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Pending Upload
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Waiting for video to be uploaded.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <StatusBadge status={videoStatus} />
            <span className="text-xs text-[var(--text-tertiary)]">
              UID: {videoUid?.slice(0, 8)}...
            </span>
            {lastChecked && (
              <span className="text-xs text-[var(--text-tertiary)]">
                • Checked {formatTimeAgo(lastChecked)}
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={checkVideoStatus}
            disabled={polling}
          >
            {polling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Check Status
              </>
            )}
          </Button>
        </div>

        {pollError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {pollError}
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // Render: Cloudflare Video - Ready
  // ============================================

  return (
    <div className={cn('space-y-2', className)}>
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
        <iframe
          src={`https://${streamDomain}/${videoUid}/iframe`}
          className="w-full h-full"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-[var(--text-tertiary)]">Cloudflare Stream</span>
          {videoDurationSeconds && (
            <span className="text-[var(--text-tertiary)]">
              • {formatDuration(videoDurationSeconds)}
            </span>
          )}
        </div>
        <Badge variant="success" size="sm">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ready
        </Badge>
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function StatusBadge({ status }: { status: VideoStatus | null }) {
  switch (status) {
    case 'ready':
      return (
        <Badge variant="success" size="sm">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ready
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="warning" size="sm">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Processing
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="error" size="sm">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="default" size="sm">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 120) return '1 minute ago';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  return `${Math.floor(seconds / 3600)} hours ago`;
}
