'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  X,
  Settings,
  Clock,
  Bot,
  Shield,
  Hash,
  Save,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Portal } from '@/components/ui/portal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: SocialSettings) => Promise<void>;
  initialSettings?: SocialSettings;
  loading?: boolean; // Show loading state while fetching initial settings
}

export interface SocialSettings {
  posting_schedule: {
    instagram: { optimal_times: string[]; max_posts_per_day: number };
    tiktok: { optimal_times: string[]; max_posts_per_day: number };
    youtube: { optimal_times: string[]; max_posts_per_day: number };
  };
  ai_settings: {
    temperature: number;
    max_suggestions_per_day: number;
    auto_generate: boolean;
    require_approval: boolean;
  };
  compliance: {
    include_disclaimer: boolean;
    disclaimer_text: string;
    require_review: boolean;
  };
  hashtag_limits: {
    instagram: { min: number; max: number; optimal: number };
    tiktok: { min: number; max: number; optimal: number };
    youtube: { min: number; max: number; optimal: number };
  };
}

const defaultSettings: SocialSettings = {
  posting_schedule: {
    instagram: { optimal_times: ['09:00', '12:00', '18:00'], max_posts_per_day: 3 },
    tiktok: { optimal_times: ['07:00', '12:00', '19:00'], max_posts_per_day: 3 },
    youtube: { optimal_times: ['14:00', '17:00'], max_posts_per_day: 1 },
  },
  ai_settings: {
    temperature: 0.7,
    max_suggestions_per_day: 10,
    auto_generate: false,
    require_approval: true,
  },
  compliance: {
    include_disclaimer: true,
    disclaimer_text: 'Educational content only. Not financial advice.',
    require_review: true,
  },
  hashtag_limits: {
    instagram: { min: 5, max: 30, optimal: 11 },
    tiktok: { min: 3, max: 8, optimal: 5 },
    youtube: { min: 0, max: 15, optimal: 8 },
  },
};

export function SettingsModal({
  isOpen,
  onClose,
  onSave,
  initialSettings,
  loading = false,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<SocialSettings>(initialSettings || defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'schedule' | 'ai' | 'compliance' | 'hashtags'>('ai');

  // Update settings when initialSettings changes (e.g., after fetch)
  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(settings);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
  };

  const sections = [
    { id: 'ai', label: 'AI Settings', icon: Bot },
    { id: 'schedule', label: 'Schedule', icon: Clock },
    { id: 'hashtags', label: 'Hashtags', icon: Hash },
    { id: 'compliance', label: 'Compliance', icon: Shield },
  ] as const;

  return (
    <Portal>
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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl max-h-[90vh] overflow-hidden"
          >
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Social Builder Settings
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
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-48 border-r border-[var(--border-primary)] p-2">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
                          activeSection === section.id
                            ? 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)] border-l-2 border-[var(--accent-primary)]'
                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {section.label}
                      </button>
                    );
                  })}
                </div>

                {/* Settings content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)] mx-auto mb-3" />
                        <p className="text-sm text-[var(--text-secondary)]">Loading settings...</p>
                      </div>
                    </div>
                  ) : (
                    <>
                  {activeSection === 'ai' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                        AI Content Generation
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-[var(--text-secondary)] mb-2">
                            Temperature (Creativity: 0.0 - 1.0)
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={settings.ai_settings.temperature}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                ai_settings: {
                                  ...settings.ai_settings,
                                  temperature: parseFloat(e.target.value),
                                },
                              })
                            }
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
                            <span>Conservative</span>
                            <span className="text-[var(--accent-primary)] font-medium">
                              {settings.ai_settings.temperature}
                            </span>
                            <span>Creative</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm text-[var(--text-secondary)] mb-2">
                            Max Suggestions Per Day
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={settings.ai_settings.max_suggestions_per_day}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                ai_settings: {
                                  ...settings.ai_settings,
                                  max_suggestions_per_day: parseInt(e.target.value),
                                },
                              })
                            }
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                          />
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.ai_settings.require_approval}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                ai_settings: {
                                  ...settings.ai_settings,
                                  require_approval: e.target.checked,
                                },
                              })
                            }
                            className="w-4 h-4 accent-[var(--accent-primary)]"
                          />
                          <span className="text-sm text-[var(--text-secondary)]">
                            Require approval before publishing
                          </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.ai_settings.auto_generate}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                ai_settings: {
                                  ...settings.ai_settings,
                                  auto_generate: e.target.checked,
                                },
                              })
                            }
                            className="w-4 h-4 accent-[var(--accent-primary)]"
                          />
                          <span className="text-sm text-[var(--text-secondary)]">
                            Auto-generate content daily
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {activeSection === 'schedule' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                        Posting Schedule
                      </h3>

                      {(['instagram', 'tiktok', 'youtube'] as const).map((platform) => (
                        <Card key={platform} variant="bordered" padding="md">
                          <h4 className="text-sm font-semibold text-[var(--text-primary)] capitalize mb-3">
                            {platform}
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-[var(--text-tertiary)] mb-1">
                                Max posts per day
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={settings.posting_schedule[platform].max_posts_per_day}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    posting_schedule: {
                                      ...settings.posting_schedule,
                                      [platform]: {
                                        ...settings.posting_schedule[platform],
                                        max_posts_per_day: parseInt(e.target.value),
                                      },
                                    },
                                  })
                                }
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[var(--text-tertiary)] mb-1">
                                Optimal times (comma separated)
                              </label>
                              <input
                                type="text"
                                value={settings.posting_schedule[platform].optimal_times.join(', ')}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    posting_schedule: {
                                      ...settings.posting_schedule,
                                      [platform]: {
                                        ...settings.posting_schedule[platform],
                                        optimal_times: e.target.value.split(',').map((t) => t.trim()),
                                      },
                                    },
                                  })
                                }
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {activeSection === 'hashtags' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                        Hashtag Limits
                      </h3>

                      {(['instagram', 'tiktok', 'youtube'] as const).map((platform) => (
                        <Card key={platform} variant="bordered" padding="md">
                          <h4 className="text-sm font-semibold text-[var(--text-primary)] capitalize mb-3">
                            {platform}
                          </h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs text-[var(--text-tertiary)] mb-1">Min</label>
                              <input
                                type="number"
                                min="0"
                                value={settings.hashtag_limits[platform].min}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    hashtag_limits: {
                                      ...settings.hashtag_limits,
                                      [platform]: {
                                        ...settings.hashtag_limits[platform],
                                        min: parseInt(e.target.value),
                                      },
                                    },
                                  })
                                }
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[var(--text-tertiary)] mb-1">Optimal</label>
                              <input
                                type="number"
                                min="0"
                                value={settings.hashtag_limits[platform].optimal}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    hashtag_limits: {
                                      ...settings.hashtag_limits,
                                      [platform]: {
                                        ...settings.hashtag_limits[platform],
                                        optimal: parseInt(e.target.value),
                                      },
                                    },
                                  })
                                }
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[var(--text-tertiary)] mb-1">Max</label>
                              <input
                                type="number"
                                min="0"
                                value={settings.hashtag_limits[platform].max}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    hashtag_limits: {
                                      ...settings.hashtag_limits,
                                      [platform]: {
                                        ...settings.hashtag_limits[platform],
                                        max: parseInt(e.target.value),
                                      },
                                    },
                                  })
                                }
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {activeSection === 'compliance' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                        Compliance & Disclaimers
                      </h3>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.compliance.include_disclaimer}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              compliance: {
                                ...settings.compliance,
                                include_disclaimer: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 accent-[var(--accent-primary)]"
                        />
                        <span className="text-sm text-[var(--text-secondary)]">
                          Include disclaimer in posts
                        </span>
                      </label>

                      <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">
                          Disclaimer Text
                        </label>
                        <textarea
                          value={settings.compliance.disclaimer_text}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              compliance: {
                                ...settings.compliance,
                                disclaimer_text: e.target.value,
                              },
                            })
                          }
                          rows={3}
                          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] resize-none focus:border-[var(--accent-primary)] focus:outline-none"
                        />
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.compliance.require_review}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              compliance: {
                                ...settings.compliance,
                                require_review: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 accent-[var(--accent-primary)]"
                        />
                        <span className="text-sm text-[var(--text-secondary)]">
                          Require manual review before publishing
                        </span>
                      </label>
                    </div>
                  )}
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 p-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <Button
                  variant="ghost"
                  onClick={handleReset}
                  icon={<RotateCcw className="w-4 h-4" />}
                >
                  Reset
                </Button>
                <div className="flex-1" />
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={isSaving}
                  icon={<Save className="w-4 h-4" />}
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
