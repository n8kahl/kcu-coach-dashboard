'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  ThumbsUp,
  ThumbsDown,
  Eye,
  Target,
  MessageSquare,
  Edit3,
  Clock,
  Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlatformBadge } from './platform-badge';
import { CategoryBadge } from './category-badge';
import type { ContentSuggestion, SocialPlatform, ContentCategory } from '@/types/social';

interface SuggestionCardProps {
  suggestion: ContentSuggestion;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onPreview?: (suggestion: ContentSuggestion) => void;
  onEdit?: (suggestion: ContentSuggestion) => void;
  className?: string;
}

export function SuggestionCard({
  suggestion,
  onApprove,
  onReject,
  onPreview,
  onEdit,
  className,
}: SuggestionCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      await onApprove(suggestion.id);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsRejecting(true);
    try {
      await onReject(suggestion.id);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Card
      variant="default"
      padding="none"
      hoverable
      className={cn('overflow-hidden', className)}
    >
      <div className="p-4">
        {/* Header with badges */}
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
          <span className="ml-auto text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(suggestion.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Hook */}
        {suggestion.suggested_hook && (
          <p className="text-[var(--accent-primary)] text-sm font-semibold mb-2">
            {suggestion.suggested_hook}
          </p>
        )}

        {/* Caption preview */}
        <p className="text-[var(--text-secondary)] text-sm line-clamp-3 mb-3">
          {suggestion.suggested_caption}
        </p>

        {/* Scores */}
        <div className="flex items-center gap-4 mb-4">
          {suggestion.predicted_engagement_score && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <Target className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>
                Engagement: <span className="text-[var(--text-primary)] font-medium">{suggestion.predicted_engagement_score}%</span>
              </span>
            </div>
          )}
          {suggestion.kcu_tone_match_score && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <MessageSquare className="w-3.5 h-3.5 text-[var(--success)]" />
              <span>
                Tone: <span className="text-[var(--text-primary)] font-medium">{suggestion.kcu_tone_match_score}%</span>
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
            loading={isApproving}
            icon={<ThumbsUp className="w-3.5 h-3.5" />}
            className="flex-1"
          >
            Approve
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleReject}
            disabled={isApproving || isRejecting}
            loading={isRejecting}
            icon={<ThumbsDown className="w-3.5 h-3.5" />}
            className="flex-1"
          >
            Reject
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPreview?.(suggestion)}
            icon={<Eye className="w-3.5 h-3.5" />}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit?.(suggestion)}
            icon={<Edit3 className="w-3.5 h-3.5" />}
          />
        </div>
      </div>
    </Card>
  );
}

interface SuggestionListItemProps {
  suggestion: ContentSuggestion;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onPreview?: (suggestion: ContentSuggestion) => void;
  className?: string;
}

export function SuggestionListItem({
  suggestion,
  onApprove,
  onReject,
  onPreview,
  className,
}: SuggestionListItemProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      await onApprove(suggestion.id);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsRejecting(true);
    try {
      await onReject(suggestion.id);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'p-4 border-b border-[var(--border-primary)] hover:bg-[var(--bg-card-hover)] transition-colors',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Platform badges */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
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
            <p className="text-[var(--accent-primary)] text-sm font-medium mb-1">
              {suggestion.suggested_hook}
            </p>
          )}

          {/* Caption preview */}
          <p className="text-[var(--text-secondary)] text-sm line-clamp-2">
            {suggestion.suggested_caption}
          </p>

          {/* Scores */}
          <div className="flex items-center gap-4 mt-3">
            {suggestion.predicted_engagement_score && (
              <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                <Target className="w-3 h-3" />
                <span>Engagement: {suggestion.predicted_engagement_score}%</span>
              </div>
            )}
            {suggestion.kcu_tone_match_score && (
              <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                <MessageSquare className="w-3 h-3" />
                <span>Tone Match: {suggestion.kcu_tone_match_score}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
            className="p-2 bg-[rgba(34,197,94,0.15)] text-[var(--success)] hover:bg-[rgba(34,197,94,0.25)] transition-colors disabled:opacity-50"
            title="Approve"
          >
            {isApproving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ThumbsUp className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleReject}
            disabled={isApproving || isRejecting}
            className="p-2 bg-[rgba(239,68,68,0.15)] text-[var(--error)] hover:bg-[rgba(239,68,68,0.25)] transition-colors disabled:opacity-50"
            title="Reject"
          >
            {isRejecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ThumbsDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onPreview?.(suggestion)}
            className="p-2 bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
