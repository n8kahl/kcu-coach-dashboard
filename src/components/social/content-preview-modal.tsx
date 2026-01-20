'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  X,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Hash,
  Smartphone,
  Edit3,
  Save,
  RotateCcw,
  Plus,
  Send,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Portal } from '@/components/ui/portal';
import { PlatformBadge, TikTokIcon } from './platform-badge';
import { CategoryBadge } from './category-badge';
import type { ContentSuggestion, SocialPlatform, ContentCategory, PlatformVariants } from '@/types/social';
import { Instagram, Youtube } from 'lucide-react';

// ============================================
// Types
// ============================================

interface EditableContent {
  suggested_caption: string;
  suggested_hook?: string;
  suggested_cta?: string;
  suggested_hashtags: string[];
  platform_variants: PlatformVariants;
}

interface PublishOptions {
  platform: SocialPlatform;
  mediaUrl: string;
}

interface ContentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: ContentSuggestion | null;
  onApprove?: (id: string, edits?: Partial<EditableContent>) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onPublish?: (id: string, options: PublishOptions) => Promise<void>;
  connectedPlatforms?: SocialPlatform[];
}

// ============================================
// Auto-resize Textarea Component
// ============================================

interface AutoResizeTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
  minRows = 3,
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      className={cn(
        'w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] resize-none focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]',
        className
      )}
    />
  );
}

// ============================================
// Hashtag Editor Component
// ============================================

interface HashtagEditorProps {
  hashtags: string[];
  onChange: (hashtags: string[]) => void;
}

function HashtagEditor({ hashtags, onChange }: HashtagEditorProps) {
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = () => {
    const tag = newTag.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      onChange([...hashtags, tag]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(hashtags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !newTag && hashtags.length > 0) {
      removeTag(hashtags[hashtags.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Hashtag chips */}
      <div className="flex flex-wrap gap-1.5">
        {hashtags.map((tag, idx) => (
          <span
            key={idx}
            className="group flex items-center gap-1 px-2 py-1 text-xs bg-[var(--bg-elevated)] text-[var(--info)] border border-[rgba(59,130,246,0.3)] hover:border-[var(--info)] transition-colors"
          >
            #{tag}
            <button
              onClick={() => removeTag(tag)}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Add new hashtag */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">#</span>
          <input
            ref={inputRef}
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value.replace(/\s/g, ''))}
            onKeyDown={handleKeyDown}
            placeholder="Add hashtag..."
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] pl-6 pr-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={addTag}
          disabled={!newTag.trim()}
          icon={<Plus className="w-4 h-4" />}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function ContentPreviewModal({
  isOpen,
  onClose,
  suggestion,
  onApprove,
  onReject,
  onPublish,
  connectedPlatforms = [],
}: ContentPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>('instagram');

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState<EditableContent | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Publish mode state
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [publishError, setPublishError] = useState<string | null>(null);

  // Initialize edited content when suggestion changes or modal opens
  useEffect(() => {
    if (suggestion) {
      setEditedContent({
        suggested_caption: suggestion.suggested_caption,
        suggested_hook: suggestion.suggested_hook,
        suggested_cta: suggestion.suggested_cta,
        suggested_hashtags: [...(suggestion.suggested_hashtags || [])],
        platform_variants: suggestion.platform_variants ? { ...suggestion.platform_variants } : {},
      });
      setHasChanges(false);
      setIsEditMode(false);
    }
  }, [suggestion]);

  if (!isOpen || !suggestion || !editedContent) return null;

  // Get current content (edited or original)
  const getCurrentCaption = () => {
    if (isEditMode && editedContent.platform_variants?.[selectedPlatform]?.caption) {
      return editedContent.platform_variants[selectedPlatform]!.caption;
    }
    if (editedContent.platform_variants?.[selectedPlatform]?.caption) {
      return editedContent.platform_variants[selectedPlatform]!.caption;
    }
    return editedContent.suggested_caption;
  };

  const getCurrentHashtags = () => {
    if (editedContent.platform_variants?.[selectedPlatform]?.hashtags?.length) {
      return editedContent.platform_variants[selectedPlatform]!.hashtags;
    }
    return editedContent.suggested_hashtags || [];
  };

  const getCurrentCTA = () => {
    return editedContent.platform_variants?.[selectedPlatform]?.cta || editedContent.suggested_cta;
  };

  // Update handlers
  const updateCaption = (caption: string) => {
    const updated = { ...editedContent };
    // Update the main caption
    updated.suggested_caption = caption;
    // Also update platform variant if exists
    if (updated.platform_variants?.[selectedPlatform]) {
      updated.platform_variants[selectedPlatform]!.caption = caption;
    }
    setEditedContent(updated);
    setHasChanges(true);
  };

  const updateHook = (hook: string) => {
    setEditedContent({ ...editedContent, suggested_hook: hook });
    setHasChanges(true);
  };

  const updateCTA = (cta: string) => {
    const updated = { ...editedContent };
    updated.suggested_cta = cta;
    if (updated.platform_variants?.[selectedPlatform]) {
      updated.platform_variants[selectedPlatform]!.cta = cta;
    }
    setEditedContent(updated);
    setHasChanges(true);
  };

  const updateHashtags = (hashtags: string[]) => {
    const updated = { ...editedContent };
    updated.suggested_hashtags = hashtags;
    if (updated.platform_variants?.[selectedPlatform]) {
      updated.platform_variants[selectedPlatform]!.hashtags = hashtags;
    }
    setEditedContent(updated);
    setHasChanges(true);
  };

  // Cancel edit mode
  const cancelEdit = () => {
    setEditedContent({
      suggested_caption: suggestion.suggested_caption,
      suggested_hook: suggestion.suggested_hook,
      suggested_cta: suggestion.suggested_cta,
      suggested_hashtags: [...(suggestion.suggested_hashtags || [])],
      platform_variants: suggestion.platform_variants ? { ...suggestion.platform_variants } : {},
    });
    setHasChanges(false);
    setIsEditMode(false);
  };

  const copyToClipboard = async () => {
    const content = getCurrentCaption();
    const hashtags = getCurrentHashtags();
    const fullText = `${content}\n\n${hashtags?.map((h) => `#${h}`).join(' ') || ''}`;

    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      // Pass the edits if there are changes
      const edits = hasChanges ? editedContent : undefined;
      await onApprove(suggestion.id, edits);
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

  const handlePublish = async () => {
    if (!onPublish || !mediaUrl.trim()) {
      setPublishError('Please enter a media URL');
      return;
    }

    // Check if platform is connected
    if (!connectedPlatforms.includes(selectedPlatform)) {
      setPublishError(`${selectedPlatform} is not connected. Please connect your account first.`);
      return;
    }

    setIsPublishing(true);
    setPublishError(null);
    try {
      await onPublish(suggestion.id, {
        platform: selectedPlatform,
        mediaUrl: mediaUrl.trim(),
      });
      setShowPublishForm(false);
      setMediaUrl('');
      onClose();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Publishing failed');
    } finally {
      setIsPublishing(false);
    }
  };

  // Check if suggestion is approved
  const isApproved = suggestion?.status === 'approved';
  const canPublish = isApproved && connectedPlatforms.includes(selectedPlatform);

  const platformIcons: Record<SocialPlatform, React.ReactNode> = {
    instagram: <Instagram className="w-4 h-4" />,
    tiktok: <TikTokIcon className="w-4 h-4" />,
    youtube: <Youtube className="w-4 h-4" />,
  };

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4"
            >
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Content Preview
                  </h2>
                  {isEditMode && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-[var(--warning)]/20 text-[var(--warning)] rounded">
                      Edit Mode
                    </span>
                  )}
                  {hasChanges && !isEditMode && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-[var(--info)]/20 text-[var(--info)] rounded">
                      Modified
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Platform tabs and Edit button */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
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

                {/* Edit toggle button */}
                {!isEditMode ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                    icon={<Edit3 className="w-4 h-4" />}
                  >
                    Edit
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelEdit}
                      icon={<RotateCcw className="w-4 h-4" />}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsEditMode(false)}
                      icon={<Save className="w-4 h-4" />}
                    >
                      Done
                    </Button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Category badge */}
                {suggestion.category && (
                  <CategoryBadge category={suggestion.category as ContentCategory} />
                )}

                {/* Hook */}
                {(editedContent.suggested_hook || isEditMode) && (
                  <div className="bg-[var(--accent-primary-glow)] p-3 border border-[var(--accent-primary-muted)]">
                    <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                      Hook
                    </p>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={editedContent.suggested_hook || ''}
                        onChange={(e) => updateHook(e.target.value)}
                        placeholder="Enter attention-grabbing hook..."
                        className="w-full bg-transparent border-0 border-b border-[var(--accent-primary-muted)] px-0 py-1 text-sm text-[var(--accent-primary)] font-medium focus:border-[var(--accent-primary)] focus:outline-none placeholder:text-[var(--accent-primary)]/50"
                      />
                    ) : (
                      <p className="text-sm text-[var(--accent-primary)] font-medium">
                        {editedContent.suggested_hook}
                      </p>
                    )}
                  </div>
                )}

                {/* Caption */}
                <div className="bg-[var(--bg-secondary)] p-4 border border-[var(--border-primary)]">
                  <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">
                    Caption
                  </p>
                  {isEditMode ? (
                    <AutoResizeTextarea
                      value={getCurrentCaption()}
                      onChange={updateCaption}
                      placeholder="Enter your caption..."
                      minRows={4}
                    />
                  ) : (
                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                      {getCurrentCaption()}
                    </p>
                  )}
                </div>

                {/* CTA */}
                {(getCurrentCTA() || isEditMode) && (
                  <div className="bg-[var(--bg-secondary)] p-3 border border-[var(--border-primary)]">
                    <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                      Call to Action
                    </p>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={getCurrentCTA() || ''}
                        onChange={(e) => updateCTA(e.target.value)}
                        placeholder="Enter call to action..."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] px-3 py-1.5 text-sm text-[var(--success)] focus:border-[var(--success)] focus:outline-none"
                      />
                    ) : (
                      <p className="text-sm text-[var(--success)]">{getCurrentCTA()}</p>
                    )}
                  </div>
                )}

                {/* Hashtags */}
                <div>
                  <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    Hashtags ({getCurrentHashtags().length})
                  </p>
                  {isEditMode ? (
                    <HashtagEditor
                      hashtags={getCurrentHashtags()}
                      onChange={updateHashtags}
                    />
                  ) : getCurrentHashtags().length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {getCurrentHashtags().map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs bg-[var(--bg-elevated)] text-[var(--info)] border border-[rgba(59,130,246,0.3)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No hashtags</p>
                  )}
                </div>

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

              {/* Publish Form (for approved suggestions) */}
              {showPublishForm && isApproved && (
                <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--bg-elevated)]">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <Send className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span>Publish to {selectedPlatform}</span>
                    </div>

                    {/* Media URL input */}
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                        Media URL (public image or video URL)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                          <input
                            type="url"
                            value={mediaUrl}
                            onChange={(e) => {
                              setMediaUrl(e.target.value);
                              setPublishError(null);
                            }}
                            placeholder="https://example.com/image.jpg"
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] pl-10 pr-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        Enter a publicly accessible URL to an image or video file
                      </p>
                    </div>

                    {/* Error message */}
                    {publishError && (
                      <div className="flex items-center gap-2 text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 border border-[var(--error)]/30">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{publishError}</span>
                      </div>
                    )}

                    {/* Platform connection warning */}
                    {!connectedPlatforms.includes(selectedPlatform) && (
                      <div className="flex items-center gap-2 text-sm text-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 border border-[var(--warning)]/30">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} is not connected.
                          Connect your account from the Overview tab.
                        </span>
                      </div>
                    )}

                    {/* Publish actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowPublishForm(false);
                          setMediaUrl('');
                          setPublishError(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handlePublish}
                        loading={isPublishing}
                        disabled={!mediaUrl.trim() || !canPublish || isPublishing}
                        icon={<Send className="w-4 h-4" />}
                      >
                        Publish Now
                      </Button>
                    </div>
                  </div>
                </div>
              )}

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

                {/* Show different actions based on suggestion status */}
                {isApproved ? (
                  // Approved suggestion: show Publish button
                  <>
                    {!showPublishForm && (
                      <Button
                        variant="primary"
                        onClick={() => setShowPublishForm(true)}
                        icon={<Send className="w-4 h-4" />}
                      >
                        Publish to {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}
                      </Button>
                    )}
                  </>
                ) : (
                  // Pending suggestion: show Approve/Reject
                  <>
                    {hasChanges && (
                      <span className="text-xs text-[var(--text-muted)] mr-2">
                        Changes will be saved on approve
                      </span>
                    )}
                    <Button
                      variant="danger"
                      onClick={handleReject}
                      loading={isRejecting}
                      disabled={isApproving || isRejecting || isEditMode}
                      icon={<ThumbsDown className="w-4 h-4" />}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="success"
                      onClick={handleApprove}
                      loading={isApproving}
                      disabled={isApproving || isRejecting || isEditMode}
                      icon={<ThumbsUp className="w-4 h-4" />}
                    >
                      {hasChanges ? 'Approve & Save' : 'Approve'}
                    </Button>
                  </>
                )}
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
