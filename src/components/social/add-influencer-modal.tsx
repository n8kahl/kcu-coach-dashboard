'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X, UserPlus, Instagram, Youtube, AtSign, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TikTokIcon } from './platform-badge';
import type { SocialPlatform, InfluencerProfileInput } from '@/types/social';

interface AddInfluencerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (influencer: InfluencerProfileInput) => Promise<void>;
}

export function AddInfluencerModal({
  isOpen,
  onClose,
  onAdd,
}: AddInfluencerModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<InfluencerProfileInput>({
    platform: 'instagram',
    handle: '',
    display_name: '',
    niche: 'day-trading',
    tags: [],
    priority: 'medium',
    notes: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!formData.handle.trim()) {
      setError('Handle is required');
      return;
    }

    setError('');
    setIsAdding(true);
    try {
      await onAdd(formData);
      onClose();
      // Reset form
      setFormData({
        platform: 'instagram',
        handle: '',
        display_name: '',
        niche: 'day-trading',
        tags: [],
        priority: 'medium',
        notes: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add influencer');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((t) => t !== tag),
    });
  };

  const platforms: { id: SocialPlatform; label: string; icon: React.ReactNode }[] = [
    { id: 'instagram', label: 'Instagram', icon: <Instagram className="w-5 h-5" /> },
    { id: 'tiktok', label: 'TikTok', icon: <TikTokIcon className="w-5 h-5" /> },
    { id: 'youtube', label: 'YouTube', icon: <Youtube className="w-5 h-5" /> },
  ];

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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
          >
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Add Influencer
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Platform selection */}
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-2">
                    Platform
                  </label>
                  <div className="flex gap-2">
                    {platforms.map((platform) => (
                      <button
                        key={platform.id}
                        onClick={() => setFormData({ ...formData, platform: platform.id })}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-2 border transition-colors',
                          formData.platform === platform.id
                            ? 'bg-[var(--accent-primary-glow)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                            : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        {platform.icon}
                        <span className="text-sm font-medium">{platform.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Handle */}
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-2">
                    Handle <span className="text-[var(--error)]">*</span>
                  </label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                    <input
                      type="text"
                      value={formData.handle}
                      onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
                      placeholder="username"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Display name */}
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-2">
                    Display Name (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-2">
                    Priority
                  </label>
                  <div className="flex gap-2">
                    {(['high', 'medium', 'low'] as const).map((priority) => (
                      <button
                        key={priority}
                        onClick={() => setFormData({ ...formData, priority })}
                        className={cn(
                          'flex-1 py-2 text-sm font-medium border capitalize transition-colors',
                          formData.priority === priority
                            ? priority === 'high'
                              ? 'bg-[rgba(239,68,68,0.15)] border-[var(--error)] text-[var(--error)]'
                              : priority === 'medium'
                                ? 'bg-[var(--accent-primary-glow)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                                : 'bg-[rgba(34,197,94,0.15)] border-[var(--success)] text-[var(--success)]'
                            : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-2">
                    Tags
                  </label>
                  <div className="flex gap-2 mb-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        placeholder="Add tag"
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleAddTag}>
                      Add
                    </Button>
                  </div>
                  {formData.tags && formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-primary)]"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="text-[var(--text-tertiary)] hover:text-[var(--error)]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any notes about this influencer..."
                    rows={3}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] resize-none focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-[rgba(239,68,68,0.15)] border border-[var(--error)] text-sm text-[var(--error)]">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 p-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <div className="flex-1" />
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  loading={isAdding}
                  icon={<UserPlus className="w-4 h-4" />}
                >
                  Add Influencer
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
