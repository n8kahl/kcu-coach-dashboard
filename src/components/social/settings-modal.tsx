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
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Instagram,
  Youtube,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Portal } from '@/components/ui/portal';
import { TikTokIcon } from './platform-badge';

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
  const [activeSection, setActiveSection] = useState<'credentials' | 'schedule' | 'ai' | 'compliance' | 'hashtags'>('credentials');

  // Credentials state
  const [credentials, setCredentials] = useState<{
    instagram: { client_id: string; client_secret: string; configured: boolean };
    tiktok: { client_id: string; client_secret: string; configured: boolean };
    youtube: { client_id: string; client_secret: string; configured: boolean };
  }>({
    instagram: { client_id: '', client_secret: '', configured: false },
    tiktok: { client_id: '', client_secret: '', configured: false },
    youtube: { client_id: '', client_secret: '', configured: false },
  });
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [credentialErrors, setCredentialErrors] = useState<Record<string, string>>({});

  // Update settings when initialSettings changes (e.g., after fetch)
  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  // Fetch credentials when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCredentials();
    }
  }, [isOpen]);

  const fetchCredentials = async () => {
    setCredentialsLoading(true);
    try {
      const response = await fetch('/api/admin/social/credentials');
      if (response.ok) {
        const data = await response.json();
        setCredentials({
          instagram: {
            client_id: data.instagram?.client_id || '',
            client_secret: '', // Never returned from server for security
            configured: data.instagram?.configured || false,
          },
          tiktok: {
            client_id: data.tiktok?.client_id || '',
            client_secret: '',
            configured: data.tiktok?.configured || false,
          },
          youtube: {
            client_id: data.youtube?.client_id || '',
            client_secret: '',
            configured: data.youtube?.configured || false,
          },
        });
      }
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
    } finally {
      setCredentialsLoading(false);
    }
  };

  const saveCredentials = async (platform: 'instagram' | 'tiktok' | 'youtube') => {
    const creds = credentials[platform];
    if (!creds.client_id || !creds.client_secret) {
      setCredentialErrors({ ...credentialErrors, [platform]: 'Both Client ID and Client Secret are required' });
      return;
    }

    setSavingPlatform(platform);
    setCredentialErrors({ ...credentialErrors, [platform]: '' });

    try {
      const response = await fetch('/api/admin/social/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          client_id: creds.client_id,
          client_secret: creds.client_secret,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save credentials');
      }

      // Update configured state
      setCredentials({
        ...credentials,
        [platform]: { ...creds, client_secret: '', configured: true },
      });
    } catch (error) {
      setCredentialErrors({
        ...credentialErrors,
        [platform]: error instanceof Error ? error.message : 'Failed to save',
      });
    } finally {
      setSavingPlatform(null);
    }
  };

  const deleteCredentials = async (platform: 'instagram' | 'tiktok' | 'youtube') => {
    setSavingPlatform(platform);
    try {
      const response = await fetch(`/api/admin/social/credentials?platform=${platform}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete credentials');
      }

      setCredentials({
        ...credentials,
        [platform]: { client_id: '', client_secret: '', configured: false },
      });
    } catch (error) {
      console.error('Failed to delete credentials:', error);
    } finally {
      setSavingPlatform(null);
    }
  };

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
    { id: 'credentials', label: 'API Keys', icon: Key },
    { id: 'ai', label: 'AI Settings', icon: Bot },
    { id: 'schedule', label: 'Schedule', icon: Clock },
    { id: 'hashtags', label: 'Hashtags', icon: Hash },
    { id: 'compliance', label: 'Compliance', icon: Shield },
  ] as const;

  const platformConfigs = [
    { id: 'instagram' as const, label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
    { id: 'tiktok' as const, label: 'TikTok', icon: TikTokIcon, color: 'text-white' },
    { id: 'youtube' as const, label: 'YouTube', icon: Youtube, color: 'text-red-500' },
  ];

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
                  {activeSection === 'credentials' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                          Social Platform API Keys
                        </h3>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1">
                          Configure OAuth credentials for each platform. These are required to connect social accounts.
                        </p>
                      </div>

                      {credentialsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {platformConfigs.map((platform) => {
                            const creds = credentials[platform.id];
                            const Icon = platform.icon;
                            const isSaving = savingPlatform === platform.id;
                            const error = credentialErrors[platform.id];

                            return (
                              <Card key={platform.id} variant="bordered" padding="md">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <Icon className={cn('w-5 h-5', platform.color)} />
                                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                                      {platform.label}
                                    </h4>
                                    {creds.configured && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-[rgba(34,197,94,0.15)] text-[var(--success)] border border-[var(--success)]">
                                        <Check className="w-3 h-3" />
                                        Configured
                                      </span>
                                    )}
                                  </div>
                                  {creds.configured && (
                                    <button
                                      onClick={() => deleteCredentials(platform.id)}
                                      disabled={isSaving}
                                      className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
                                      title="Remove credentials"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>

                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-xs text-[var(--text-tertiary)] mb-1">
                                      Client ID / App ID
                                    </label>
                                    <input
                                      type="text"
                                      value={creds.client_id}
                                      onChange={(e) =>
                                        setCredentials({
                                          ...credentials,
                                          [platform.id]: { ...creds, client_id: e.target.value },
                                        })
                                      }
                                      placeholder={creds.configured ? '••••••••' : 'Enter Client ID'}
                                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-[var(--text-tertiary)] mb-1">
                                      Client Secret / App Secret
                                    </label>
                                    <div className="relative">
                                      <input
                                        type={showSecrets[platform.id] ? 'text' : 'password'}
                                        value={creds.client_secret}
                                        onChange={(e) =>
                                          setCredentials({
                                            ...credentials,
                                            [platform.id]: { ...creds, client_secret: e.target.value },
                                          })
                                        }
                                        placeholder={creds.configured ? '••••••••••••••••' : 'Enter Client Secret'}
                                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 pr-10 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowSecrets({ ...showSecrets, [platform.id]: !showSecrets[platform.id] })}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                      >
                                        {showSecrets[platform.id] ? (
                                          <EyeOff className="w-4 h-4" />
                                        ) : (
                                          <Eye className="w-4 h-4" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {error && (
                                    <div className="flex items-center gap-2 text-xs text-[var(--error)]">
                                      <AlertCircle className="w-3 h-3" />
                                      {error}
                                    </div>
                                  )}

                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => saveCredentials(platform.id)}
                                    loading={isSaving}
                                    className="w-full"
                                  >
                                    {creds.configured ? 'Update Credentials' : 'Save Credentials'}
                                  </Button>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}

                      <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-primary)] text-xs text-[var(--text-tertiary)]">
                        <p className="font-medium text-[var(--text-secondary)] mb-1">Where to get credentials:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li><strong>Instagram:</strong> Meta for Developers → Create App → Instagram Basic Display</li>
                          <li><strong>TikTok:</strong> TikTok for Developers → Create App → Login Kit</li>
                          <li><strong>YouTube:</strong> Google Cloud Console → Create Project → OAuth 2.0 Credentials</li>
                        </ul>
                      </div>
                    </div>
                  )}

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
