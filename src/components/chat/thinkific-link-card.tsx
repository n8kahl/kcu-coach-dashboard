'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, ExternalLink, Clock, GraduationCap, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ThinkificLinkContent } from '@/types';

// ============================================
// Types
// ============================================

interface ThinkificLinkCardProps {
  content: ThinkificLinkContent;
  variant?: 'default' | 'compact';
  className?: string;
}

// ============================================
// Utility Functions
// ============================================

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// Main Component
// ============================================

export function ThinkificLinkCard({
  content,
  variant = 'default',
  className,
}: ThinkificLinkCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { courseSlug, lessonSlug, title, timestampSeconds, description } = content;

  const handleOpen = async () => {
    setIsLoading(true);
    try {
      // Call SSO API to get authenticated URL
      const response = await fetch('/api/thinkific/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'lesson',
          courseSlug,
          lessonSlug,
          timestampSeconds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        window.open(data.ssoUrl, '_blank');
      } else {
        // Fallback to direct URL without SSO
        const directUrl = `https://kaycapitals.thinkific.com/courses/${courseSlug}/lessons/${lessonSlug}${
          timestampSeconds ? `?t=${timestampSeconds}` : ''
        }`;
        window.open(directUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to generate SSO URL:', error);
      // Fallback to direct URL
      const directUrl = `https://kaycapitals.thinkific.com/courses/${courseSlug}/lessons/${lessonSlug}`;
      window.open(directUrl, '_blank');
    } finally {
      setIsLoading(false);
    }
  };

  // Compact variant for inline use
  if (variant === 'compact') {
    return (
      <motion.button
        onClick={handleOpen}
        disabled={isLoading}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
          'bg-[var(--bg-elevated)] hover:bg-[rgba(99,102,241,0.1)]',
          'border border-[var(--border-primary)] hover:border-[rgb(99,102,241)]',
          'transition-all duration-200 cursor-pointer',
          isLoading && 'opacity-70 cursor-wait',
          className
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[rgb(99,102,241)]" />
        ) : (
          <GraduationCap
            className={cn(
              'w-3.5 h-3.5 transition-colors',
              isHovered ? 'text-[rgb(99,102,241)]' : 'text-[var(--text-secondary)]'
            )}
          />
        )}
        <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
        {timestampSeconds && timestampSeconds > 0 && (
          <Badge variant="default" size="sm" className="text-xs bg-[rgba(99,102,241,0.2)] text-[rgb(99,102,241)]">
            {formatTimestamp(timestampSeconds)}
          </Badge>
        )}
      </motion.button>
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
        className="overflow-hidden border-l-4 border-l-[rgb(99,102,241)]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Icon Button */}
            <motion.button
              onClick={handleOpen}
              disabled={isLoading}
              className="flex-shrink-0 w-12 h-12 rounded-full bg-[rgb(99,102,241)]
                         flex items-center justify-center hover:brightness-110
                         transition-all shadow-lg disabled:opacity-70"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <GraduationCap className="w-5 h-5 text-white" />
              )}
            </motion.button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-semibold text-[var(--text-primary)] truncate">
                  {title}
                </h4>
                <Badge variant="default" size="sm" className="flex-shrink-0 bg-[rgba(99,102,241,0.2)] text-[rgb(99,102,241)]">
                  Thinkific Course
                </Badge>
                {timestampSeconds && timestampSeconds > 0 && (
                  <Badge variant="default" size="sm" className="flex-shrink-0">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTimestamp(timestampSeconds)}
                  </Badge>
                )}
              </div>

              {description && (
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-2">
                  {description}
                </p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" size="sm" className="text-xs">
                  {courseSlug.replace(/-/g, ' ')}
                </Badge>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpen}
                  disabled={isLoading}
                  className="text-xs h-6 px-2 ml-auto text-[rgb(99,102,241)] hover:text-[rgb(99,102,241)] hover:bg-[rgba(99,102,241,0.1)]"
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <ExternalLink className="w-3 h-3 mr-1" />
                  )}
                  Open Lesson
                  <ChevronRight className="w-3 h-3 ml-1" />
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
// Inline Thinkific Link Component
// For use within text content
// ============================================

interface InlineThinkificLinkProps {
  courseSlug: string;
  lessonSlug: string;
  timestampSeconds?: number;
  label: string;
}

export function InlineThinkificLink({
  courseSlug,
  lessonSlug,
  timestampSeconds,
  label,
}: InlineThinkificLinkProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/thinkific/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'lesson',
          courseSlug,
          lessonSlug,
          timestampSeconds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        window.open(data.ssoUrl, '_blank');
      } else {
        const directUrl = `https://kaycapitals.thinkific.com/courses/${courseSlug}/lessons/${lessonSlug}`;
        window.open(directUrl, '_blank');
      }
    } catch {
      const directUrl = `https://kaycapitals.thinkific.com/courses/${courseSlug}/lessons/${lessonSlug}`;
      window.open(directUrl, '_blank');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="inline-flex items-center gap-1 text-[rgb(99,102,241)]
                 hover:text-[rgb(129,140,248)] transition-colors
                 underline decoration-dotted underline-offset-2
                 disabled:opacity-70"
    >
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <GraduationCap className="w-3 h-3" />
      )}
      <span>{label}</span>
      {timestampSeconds && timestampSeconds > 0 && (
        <span className="text-xs opacity-70">({formatTimestamp(timestampSeconds)})</span>
      )}
    </button>
  );
}

export default ThinkificLinkCard;
