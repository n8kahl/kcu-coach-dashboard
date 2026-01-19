'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  X,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Hash,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlatformBadge, TikTokIcon } from './platform-badge';
import { CategoryBadge } from './category-badge';
import type { ContentSuggestion, SocialPlatform, ContentCategory } from '@/types/social';
import { Instagram, Youtube } from 'lucide-react';

interface ContentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: ContentSuggestion | null;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
}

export function ContentPreviewModal({
  isOpen,
  onClose,
  suggestion,
  onApprove,
  onReject,
}: ContentPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>('instagram');

  if (!isOpen || !suggestion) return null;

  const copyToClipboard = async () => {
    const content = suggestion.platform_variants?.[selectedPlatform]?.caption || suggestion.suggested_caption;
    const hashtags = suggestion.platform_variants?.[selectedPlatform]?.hashtags || suggestion.suggested_hashtags;
    const fullText = `${content}\n\n${hashtags?.map(h => `#${h}`).join(' ') || ''}`;

    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      await onApprove(suggestion.id);
      onClose();
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsRejecting(true);
    try {
      await onReject(suggestion.id);
      onClose();
    } finally {
      setIsRejecting(false);
    }
  };

  const currentCaption = suggestion.platform_variants?.[selectedPlatform]?.caption || suggestion.suggested_caption;
  const currentHashtags = suggestion.platform_variants?.[selectedPlatform]?.hashtags || suggestion.suggested_hashtags || [];
  const currentCTA = suggestion.platform_variants?.[selectedPlatform]?.cta || suggestion.suggested_cta;

  const platformIcons: Record<SocialPlatform, React.ReactNode> = {
    instagram: <Instagram className="w-4 h-4" />,
    tiktok: <TikTokIcon className="w-4 h-4" />,
    youtube: <Youtube className="w-4 h-4" />,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-hidden"
          >
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Content Preview
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Platform tabs */}
              <div className="flex items-center gap-2 p-4 border-b border-[var(--border-primary)]">
                {suggestion.platforms.map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform as SocialPlatform)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors',
                      selectedPlatform === platform
                        ? 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)] border border-[var(--accent-primary-muted)]'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {platformIcons[platform as SocialPlatform]}
                    <span className="capitalize">{platform}</span>
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Category badge */}
                {suggestion.category && (
                  <CategoryBadge category={suggestion.category as ContentCategory} />
                )}

                {/* Hook */}
                {suggestion.suggested_hook && (
                  <div className="bg-[var(--accent-primary-glow)] p-3 border border-[var(--accent-primary-muted)]">
                    <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                      Hook
                    </p>
                    <p className="text-sm text-[var(--accent-primary)] font-medium">
                      {suggestion.suggested_hook}
                    </p>
                  </div>
                )}

                {/* Caption */}
                <div className="bg-[var(--bg-secondary)] p-4 border border-[var(--border-primary)]">
                  <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">
                    Caption
                  </p>
                  <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                    {currentCaption}
                  </p>
                </div>

                {/* CTA */}
                {currentCTA && (
                  <div className="bg-[var(--bg-secondary)] p-3 border border-[var(--border-primary)]">
                    <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                      Call to Action
                    </p>
                    <p className="text-sm text-[var(--success)]">
                      {currentCTA}
                    </p>
                  </div>
                )}

                {/* Hashtags */}
                {currentHashtags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      Hashtags ({currentHashtags.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {currentHashtags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs bg-[var(--bg-elevated)] text-[var(--info)] border border-[rgba(59,130,246,0.3)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scores */}
                <div className="grid grid-cols-2 gap-4">
                  {suggestion.predicted_engagement_score && (
                    <div className="bg-[var(--bg-secondary)] p-3 border border-[var(--border-primary)]">
                      <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                        Predicted Engagement
                      </p>
                      <p className="text-2xl font-bold text-[var(--accent-primary)]">
                        {suggestion.predicted_engagement_score}%
                      </p>
                    </div>
                  )}
                  {suggestion.kcu_tone_match_score && (
                    <div className="bg-[var(--bg-secondary)] p-3 border border-[var(--border-primary)]">
                      <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                        Tone Match
                      </p>
                      <p className="text-2xl font-bold text-[var(--success)]">
                        {suggestion.kcu_tone_match_score}%
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 p-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <Button
                  variant="secondary"
                  onClick={copyToClipboard}
                  icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <div className="flex-1" />
                <Button
                  variant="danger"
                  onClick={handleReject}
                  loading={isRejecting}
                  disabled={isApproving || isRejecting}
                  icon={<ThumbsDown className="w-4 h-4" />}
                >
                  Reject
                </Button>
                <Button
                  variant="success"
                  onClick={handleApprove}
                  loading={isApproving}
                  disabled={isApproving || isRejecting}
                  icon={<ThumbsUp className="w-4 h-4" />}
                >
                  Approve
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
