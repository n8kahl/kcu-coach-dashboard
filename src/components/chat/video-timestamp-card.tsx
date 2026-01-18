'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, ExternalLink, Clock, BookOpen, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export interface VideoTimestampContent {
  type: 'video_timestamp';
  videoId: string;
  startMs: number;
  endMs: number;
  title: string;
  description?: string;
  relatedLesson?: {
    moduleId: string;
    moduleSlug: string;
    lessonId: string;
    lessonSlug: string;
    lessonTitle?: string;
  };
}

interface VideoTimestampCardProps {
  content: VideoTimestampContent;
  onPlay?: (videoId: string, startMs: number, endMs: number) => void;
  variant?: 'default' | 'compact' | 'remediation';
  className?: string;
}

// ============================================
// Utility Functions
// ============================================

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getClipDuration(startMs: number, endMs: number): number {
  return Math.round((endMs - startMs) / 1000);
}

function generateYouTubeUrl(videoId: string, startMs: number): string {
  const startSeconds = Math.floor(startMs / 1000);
  return `https://www.youtube.com/watch?v=${videoId}&t=${startSeconds}s`;
}

// ============================================
// Main Component
// ============================================

export function VideoTimestampCard({
  content,
  onPlay,
  variant = 'default',
  className,
}: VideoTimestampCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { videoId, startMs, endMs, title, description, relatedLesson } = content;

  const duration = getClipDuration(startMs, endMs);
  const youtubeUrl = generateYouTubeUrl(videoId, startMs);

  const handlePlay = () => {
    if (onPlay) {
      onPlay(videoId, startMs, endMs);
    } else {
      window.open(youtubeUrl, '_blank');
    }
  };

  const handleNavigateToLesson = () => {
    if (relatedLesson) {
      const url = `/learning/${relatedLesson.moduleSlug}/${relatedLesson.lessonSlug}?t=${startMs}`;
      window.location.href = url;
    }
  };

  // Compact variant for inline use
  if (variant === 'compact') {
    return (
      <motion.button
        onClick={handlePlay}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
          'bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary-glow)]',
          'border border-[var(--border-primary)] hover:border-[var(--accent-primary)]',
          'transition-all duration-200 cursor-pointer',
          className
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Play
          className={cn(
            'w-3.5 h-3.5 transition-colors',
            isHovered ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
          )}
          fill={isHovered ? 'currentColor' : 'none'}
        />
        <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
        <Badge variant="default" size="sm" className="text-xs">
          {formatTimestamp(startMs)}
        </Badge>
      </motion.button>
    );
  }

  // Remediation variant for quiz results
  if (variant === 'remediation') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg',
          'bg-[rgba(245,166,35,0.1)] border border-[rgba(245,166,35,0.3)]',
          className
        )}
      >
        <button
          onClick={handlePlay}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--accent-primary)]
                     flex items-center justify-center hover:brightness-110
                     transition-all shadow-md"
        >
          <Play className="w-4 h-4 text-black ml-0.5" fill="currentColor" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            Review: {title}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {formatTimestamp(startMs)} - {formatTimestamp(endMs)} ({duration}s)
          </p>
        </div>

        {relatedLesson && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNavigateToLesson}
            className="flex-shrink-0"
          >
            <BookOpen className="w-4 h-4" />
          </Button>
        )}
      </motion.div>
    );
  }

  // Default full card variant
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      <Card
        variant="elevated"
        hoverable
        className="overflow-hidden border-l-4 border-l-[var(--accent-primary)]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Play Button */}
            <motion.button
              onClick={handlePlay}
              className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--accent-primary)]
                         flex items-center justify-center hover:brightness-110
                         transition-all shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Play className="w-5 h-5 text-black ml-0.5" fill="currentColor" />
            </motion.button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-semibold text-[var(--text-primary)] truncate">
                  {title}
                </h4>
                <Badge variant="gold" size="sm" className="flex-shrink-0">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTimestamp(startMs)} - {formatTimestamp(endMs)}
                </Badge>
              </div>

              {description && (
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-2">
                  {description}
                </p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" size="sm">
                  {duration}s clip
                </Badge>

                {relatedLesson && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNavigateToLesson}
                    className="text-xs h-6 px-2"
                  >
                    {relatedLesson.lessonTitle || 'Open in Lesson'}
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(youtubeUrl, '_blank')}
                  className="text-xs h-6 px-2 ml-auto"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  YouTube
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// Inline Video Link Component
// For use within text content
// ============================================

interface InlineVideoLinkProps {
  videoId: string;
  startMs: number;
  endMs?: number;
  label: string;
  onClick?: () => void;
}

export function InlineVideoLink({
  videoId,
  startMs,
  endMs,
  label,
  onClick,
}: InlineVideoLinkProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      const url = generateYouTubeUrl(videoId, startMs);
      window.open(url, '_blank');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-[var(--accent-primary)]
                 hover:text-[var(--accent-primary-hover)] transition-colors
                 underline decoration-dotted underline-offset-2"
    >
      <Play className="w-3 h-3" />
      <span>{label}</span>
      <span className="text-xs opacity-70">({formatTimestamp(startMs)})</span>
    </button>
  );
}

// ============================================
// Video Timestamp List Component
// For displaying multiple timestamps
// ============================================

interface VideoTimestampListProps {
  timestamps: VideoTimestampContent[];
  title?: string;
  onPlay?: (videoId: string, startMs: number, endMs: number) => void;
}

export function VideoTimestampList({
  timestamps,
  title = 'Related Video Clips',
  onPlay,
}: VideoTimestampListProps) {
  if (timestamps.length === 0) return null;

  return (
    <div className="space-y-3">
      {title && (
        <h4 className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
          <Play className="w-4 h-4" />
          {title}
        </h4>
      )}
      <div className="space-y-2">
        {timestamps.map((timestamp, index) => (
          <VideoTimestampCard
            key={`${timestamp.videoId}-${timestamp.startMs}-${index}`}
            content={timestamp}
            onPlay={onPlay}
            variant="compact"
          />
        ))}
      </div>
    </div>
  );
}

export default VideoTimestampCard;
