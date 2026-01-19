'use client';

/**
 * NotificationPermissionBanner
 *
 * A banner component that prompts users to enable browser notifications
 * for background setup alerts. Shows different states based on permission status.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Bell, BellOff, X, CheckCircle, AlertTriangle } from 'lucide-react';

export interface NotificationPermissionBannerProps {
  permission: NotificationPermission | 'unsupported';
  onRequestPermission: () => Promise<NotificationPermission | 'unsupported'>;
  className?: string;
  /** Called after permission is granted or denied */
  onPermissionChange?: (permission: NotificationPermission | 'unsupported') => void;
}

export function NotificationPermissionBanner({
  permission,
  onRequestPermission,
  className,
  onPermissionChange,
}: NotificationPermissionBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Don't show if already granted, denied, or dismissed
  if (permission === 'granted' || permission === 'denied' || permission === 'unsupported' || dismissed) {
    return null;
  }

  const handleRequest = async () => {
    setRequesting(true);
    try {
      const result = await onRequestPermission();
      onPermissionChange?.(result);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        'bg-kcu-gold-dim border-b border-kcu-gold/30',
        'animate-slide-down-fade',
        className
      )}
    >
      <Bell className="w-5 h-5 text-kcu-gold flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)]">
          <span className="font-semibold">Enable notifications</span> to get alerts when high-quality setups appear
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleRequest}
          disabled={requesting}
          className={cn(
            'btn-sharp-primary text-xs px-3 py-1.5',
            requesting && 'opacity-50 cursor-wait'
          )}
        >
          {requesting ? 'Requesting...' : 'Enable'}
        </button>

        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * NotificationStatus
 *
 * A small status indicator showing current notification permission state.
 * Useful for settings pages or status bars.
 */
export interface NotificationStatusProps {
  permission: NotificationPermission | 'unsupported';
  onRequestPermission?: () => void;
  className?: string;
}

export function NotificationStatus({
  permission,
  onRequestPermission,
  className,
}: NotificationStatusProps) {
  const statusConfig = {
    granted: {
      icon: CheckCircle,
      text: 'Notifications enabled',
      color: 'text-[var(--success)]',
      bgColor: 'bg-[var(--success)]/10',
    },
    denied: {
      icon: BellOff,
      text: 'Notifications blocked',
      color: 'text-[var(--error)]',
      bgColor: 'bg-[var(--error)]/10',
    },
    default: {
      icon: Bell,
      text: 'Notifications off',
      color: 'text-[var(--text-tertiary)]',
      bgColor: 'bg-[var(--bg-elevated)]',
    },
    unsupported: {
      icon: AlertTriangle,
      text: 'Not supported',
      color: 'text-[var(--text-muted)]',
      bgColor: 'bg-[var(--bg-elevated)]',
    },
  };

  const config = statusConfig[permission];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 text-xs',
        config.bgColor,
        config.color,
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{config.text}</span>

      {permission === 'default' && onRequestPermission && (
        <button
          onClick={onRequestPermission}
          className="ml-1 underline hover:no-underline"
        >
          Enable
        </button>
      )}
    </div>
  );
}

/**
 * BackgroundAlertSettings
 *
 * A settings panel for configuring background alert preferences.
 */
export interface BackgroundAlertSettingsProps {
  permission: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
  settings: {
    enableNotifications: boolean;
    enableTitleTicker: boolean;
    enableFaviconBadge: boolean;
    enableSound: boolean;
    ltpThreshold: number;
  };
  onSettingsChange: (settings: BackgroundAlertSettingsProps['settings']) => void;
  className?: string;
}

export function BackgroundAlertSettings({
  permission,
  onRequestPermission,
  settings,
  onSettingsChange,
  className,
}: BackgroundAlertSettingsProps) {
  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Background Alerts
        </h3>
        <NotificationStatus permission={permission} onRequestPermission={onRequestPermission} />
      </div>

      <div className="space-y-3">
        {/* Browser Notifications */}
        <label className="flex items-center justify-between p-3 border-thin hover:border-kcu-gold/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-[var(--text-tertiary)]" />
            <div>
              <p className="text-sm text-[var(--text-primary)]">Browser Notifications</p>
              <p className="text-xs text-[var(--text-tertiary)]">Get system alerts for high-quality setups</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.enableNotifications}
            onChange={(e) => updateSetting('enableNotifications', e.target.checked)}
            disabled={permission !== 'granted'}
            className="w-4 h-4 accent-kcu-gold"
          />
        </label>

        {/* Tab Title Ticker */}
        <label className="flex items-center justify-between p-3 border-thin hover:border-kcu-gold/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 text-[var(--text-tertiary)] text-center">⚡</span>
            <div>
              <p className="text-sm text-[var(--text-primary)]">Tab Title Ticker</p>
              <p className="text-xs text-[var(--text-tertiary)]">Scroll setup info in browser tab</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.enableTitleTicker}
            onChange={(e) => updateSetting('enableTitleTicker', e.target.checked)}
            className="w-4 h-4 accent-kcu-gold"
          />
        </label>

        {/* Favicon Badge */}
        <label className="flex items-center justify-between p-3 border-thin hover:border-kcu-gold/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 text-[var(--text-tertiary)] text-center">🔴</span>
            <div>
              <p className="text-sm text-[var(--text-primary)]">Favicon Badge</p>
              <p className="text-xs text-[var(--text-tertiary)]">Show count on browser icon</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.enableFaviconBadge}
            onChange={(e) => updateSetting('enableFaviconBadge', e.target.checked)}
            className="w-4 h-4 accent-kcu-gold"
          />
        </label>

        {/* Sound */}
        <label className="flex items-center justify-between p-3 border-thin hover:border-kcu-gold/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 text-[var(--text-tertiary)] text-center">🔔</span>
            <div>
              <p className="text-sm text-[var(--text-primary)]">Sound Alert</p>
              <p className="text-xs text-[var(--text-tertiary)]">Play a tone for new setups</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.enableSound}
            onChange={(e) => updateSetting('enableSound', e.target.checked)}
            className="w-4 h-4 accent-kcu-gold"
          />
        </label>

        {/* LTP Threshold */}
        <div className="p-3 border-thin">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 text-[var(--text-tertiary)] text-center">📊</span>
              <div>
                <p className="text-sm text-[var(--text-primary)]">LTP Threshold</p>
                <p className="text-xs text-[var(--text-tertiary)]">Minimum score for alerts</p>
              </div>
            </div>
            <span className="text-sm font-mono text-kcu-gold">{settings.ltpThreshold}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={settings.ltpThreshold}
            onChange={(e) => updateSetting('ltpThreshold', parseInt(e.target.value))}
            className="w-full h-1 bg-[var(--bg-elevated)] appearance-none cursor-pointer accent-kcu-gold"
          />
          <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
            <span>50%</span>
            <span>95%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationPermissionBanner;
