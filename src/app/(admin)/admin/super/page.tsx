'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  ShieldCheck,
  Settings,
  Users,
  Database,
  Sliders,
  Save,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Check,
  Eye,
  Target,
  Zap,
  BarChart3
} from 'lucide-react';

interface StrategyConfig {
  id: string;
  name: string;
  category: string;
  config: Record<string, any>;
  is_active: boolean;
  updated_at: string;
}

interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
}

export default function SuperAdminPage() {
  const [configs, setConfigs] = useState<StrategyConfig[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'ltp' | 'mtf' | 'alerts' | 'ai' | 'roles'>('ltp');
  const [editedConfigs, setEditedConfigs] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchConfigs();
    fetchRoles();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/configs');
      const data = await res.json();
      setConfigs(data.configs || []);

      // Initialize edited configs
      const edited: Record<string, any> = {};
      for (const c of data.configs || []) {
        edited[c.name] = c.config;
      }
      setEditedConfigs(edited);
    } catch (error) {
      console.error('Error fetching configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/admin/roles');
      const data = await res.json();
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const saveConfig = async (name: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config: editedConfigs[name] })
      });

      if (res.ok) {
        fetchConfigs();
      }
    } catch (error) {
      console.error('Error saving config:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateConfigField = (configName: string, field: string, value: any) => {
    setEditedConfigs(prev => ({
      ...prev,
      [configName]: {
        ...prev[configName],
        [field]: value
      }
    }));
  };

  const getConfigByName = (name: string) => {
    return configs.find(c => c.name === name);
  };

  const tabs = [
    { id: 'ltp', label: 'LTP Detection', icon: Target },
    { id: 'mtf', label: 'MTF Analysis', icon: BarChart3 },
    { id: 'alerts', label: 'Alert Templates', icon: Zap },
    { id: 'ai', label: 'AI Coach', icon: Settings },
    { id: 'roles', label: 'Roles & Permissions', icon: Users }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-[var(--accent-primary)]" />
            Super Admin
          </h1>
          <p className="text-[var(--text-secondary)]">
            Configure LTP detection, MTF analysis, alerts, and system settings
          </p>
        </div>
        <div className="badge badge-gold flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          RESTRICTED ACCESS
        </div>
      </div>

      {/* Warning Banner */}
      <div className="card p-4 border-l-4 border-[var(--warning)] bg-[var(--warning-muted)]">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Changes here affect the entire platform. Test thoroughly before saving.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border-primary)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium uppercase tracking-wide transition-all',
                activeTab === tab.id
                  ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="card p-6">
        {activeTab === 'ltp' && (
          <LTPConfigPanel
            config={editedConfigs['ltp_detection_thresholds'] || {}}
            onUpdate={(field, value) => updateConfigField('ltp_detection_thresholds', field, value)}
            onSave={() => saveConfig('ltp_detection_thresholds')}
            saving={saving}
          />
        )}

        {activeTab === 'mtf' && (
          <MTFConfigPanel
            config={editedConfigs['mtf_timeframes'] || {}}
            onUpdate={(field, value) => updateConfigField('mtf_timeframes', field, value)}
            onSave={() => saveConfig('mtf_timeframes')}
            saving={saving}
          />
        )}

        {activeTab === 'ai' && (
          <AIConfigPanel
            config={editedConfigs['ai_coach_settings'] || {}}
            onUpdate={(field, value) => updateConfigField('ai_coach_settings', field, value)}
            onSave={() => saveConfig('ai_coach_settings')}
            saving={saving}
          />
        )}

        {activeTab === 'roles' && (
          <RolesPanel roles={roles} onRefresh={fetchRoles} />
        )}

        {activeTab === 'alerts' && (
          <AlertTemplatesPanel />
        )}
      </div>
    </div>
  );
}

// LTP Detection Configuration Panel
function LTPConfigPanel({
  config,
  onUpdate,
  onSave,
  saving
}: {
  config: any;
  onUpdate: (field: string, value: any) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          LTP Detection Thresholds
        </h3>
        <button onClick={onSave} disabled={saving} className="btn btn-primary">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            Confluence Threshold
          </label>
          <input
            type="number"
            value={config.confluence_threshold || 70}
            onChange={(e) => onUpdate('confluence_threshold', parseInt(e.target.value))}
            className="input"
            min="0"
            max="100"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Minimum score to mark setup as "Ready" (0-100)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            Level Proximity %
          </label>
          <input
            type="number"
            step="0.1"
            value={config.level_proximity_percent || 0.3}
            onChange={(e) => onUpdate('level_proximity_percent', parseFloat(e.target.value))}
            className="input"
            min="0.1"
            max="2"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            How close price must be to level (percentage)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            Max Patience Candle Size %
          </label>
          <input
            type="number"
            step="0.1"
            value={config.patience_candle_max_size_percent || 0.5}
            onChange={(e) => onUpdate('patience_candle_max_size_percent', parseFloat(e.target.value))}
            className="input"
            min="0.1"
            max="2"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Maximum body size for patience candle (percentage)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            Min Level Strength
          </label>
          <input
            type="number"
            value={config.min_level_strength || 50}
            onChange={(e) => onUpdate('min_level_strength', parseInt(e.target.value))}
            className="input"
            min="0"
            max="100"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Minimum level strength to consider (0-100)
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.trend_ema_alignment_required || false}
              onChange={(e) => onUpdate('trend_ema_alignment_required', e.target.checked)}
              className="w-4 h-4 accent-[var(--accent-primary)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">
              Require EMA alignment for trend confirmation
            </span>
          </label>
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.orb_break_required || false}
              onChange={(e) => onUpdate('orb_break_required', e.target.checked)}
              className="w-4 h-4 accent-[var(--accent-primary)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">
              Require ORB break for setup validation
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

// MTF Configuration Panel
function MTFConfigPanel({
  config,
  onUpdate,
  onSave,
  saving
}: {
  config: any;
  onUpdate: (field: string, value: any) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const allTimeframes = ['2m', '5m', '15m', '1h', '4h', 'daily', 'weekly'];
  const enabled = config.enabled_timeframes || allTimeframes;
  const weights = config.weights || {};

  const toggleTimeframe = (tf: string) => {
    const newEnabled = enabled.includes(tf)
      ? enabled.filter((t: string) => t !== tf)
      : [...enabled, tf];
    onUpdate('enabled_timeframes', newEnabled);
  };

  const updateWeight = (tf: string, weight: number) => {
    onUpdate('weights', { ...weights, [tf]: weight });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          MTF Analysis Configuration
        </h3>
        <button onClick={onSave} disabled={saving} className="btn btn-primary">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Configure which timeframes to analyze and their weights in the alignment score.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allTimeframes.map((tf) => (
            <div
              key={tf}
              className={cn(
                'p-4 border transition-all cursor-pointer',
                enabled.includes(tf)
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-glow)]'
                  : 'border-[var(--border-primary)]'
              )}
              onClick={() => toggleTimeframe(tf)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-[var(--text-primary)] uppercase">{tf}</span>
                <div className={cn(
                  'w-5 h-5 border flex items-center justify-center',
                  enabled.includes(tf)
                    ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                    : 'border-[var(--border-secondary)]'
                )}>
                  {enabled.includes(tf) && <Check className="w-3 h-3 text-[var(--bg-primary)]" />}
                </div>
              </div>
              {enabled.includes(tf) && (
                <div onClick={(e) => e.stopPropagation()}>
                  <label className="text-xs text-[var(--text-tertiary)] uppercase">Weight</label>
                  <input
                    type="number"
                    step="0.05"
                    value={weights[tf] || 0.1}
                    onChange={(e) => updateWeight(tf, parseFloat(e.target.value))}
                    className="input mt-1"
                    min="0"
                    max="1"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// AI Coach Configuration Panel
function AIConfigPanel({
  config,
  onUpdate,
  onSave,
  saving
}: {
  config: any;
  onUpdate: (field: string, value: any) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          AI Coach Settings
        </h3>
        <button onClick={onSave} disabled={saving} className="btn btn-primary">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            AI Model
          </label>
          <select
            value={config.model || 'claude-sonnet-4-20250514'}
            onChange={(e) => onUpdate('model', e.target.value)}
            className="input"
          >
            <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
            <option value="claude-3-opus-20240229">Claude 3 Opus</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            Temperature
          </label>
          <input
            type="number"
            step="0.1"
            value={config.temperature || 0.7}
            onChange={(e) => onUpdate('temperature', parseFloat(e.target.value))}
            className="input"
            min="0"
            max="1"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            0 = Deterministic, 1 = Creative
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            Max Tokens
          </label>
          <input
            type="number"
            value={config.max_tokens || 1024}
            onChange={(e) => onUpdate('max_tokens', parseInt(e.target.value))}
            className="input"
            min="256"
            max="4096"
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.include_market_context ?? true}
              onChange={(e) => onUpdate('include_market_context', e.target.checked)}
              className="w-4 h-4 accent-[var(--accent-primary)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">
              Include market context in responses
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.include_user_trades ?? true}
              onChange={(e) => onUpdate('include_user_trades', e.target.checked)}
              className="w-4 h-4 accent-[var(--accent-primary)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">
              Include user's trade history for context
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

// Roles Panel
function RolesPanel({ roles, onRefresh }: { roles: UserRole[]; onRefresh: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          Roles & Permissions
        </h3>
        <button onClick={onRefresh} className="btn btn-secondary">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {roles.map((role) => (
          <div key={role.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-[var(--text-primary)] uppercase">{role.name}</h4>
                <p className="text-sm text-[var(--text-tertiary)]">{role.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(role.permissions).map(([perm, enabled]) => (
                <span
                  key={perm}
                  className={cn(
                    'badge text-xs',
                    enabled ? 'badge-success' : 'badge-neutral'
                  )}
                >
                  {perm.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Alert Templates Panel
function AlertTemplatesPanel() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          Alert Templates
        </h3>
        <button className="btn btn-primary">
          Add Template
        </button>
      </div>

      <p className="text-sm text-[var(--text-secondary)]">
        Configure message templates for different alert types. Use {'{{variable}}'} syntax for dynamic content.
      </p>

      <div className="text-center py-12 text-[var(--text-tertiary)]">
        <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Alert templates coming soon</p>
      </div>
    </div>
  );
}
