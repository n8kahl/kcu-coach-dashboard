'use client';

/**
 * useBackgroundAlerts Hook
 *
 * Manages background notifications for Companion Mode when the tab is not focused.
 * Implements three alert mechanisms:
 *
 * 1. Browser Notifications: System-level alerts for high-quality setups (LTP > 80)
 * 2. Tab Title Ticker: Scrolling text in browser tab showing active setup
 * 3. Favicon Badge: Visual indicator showing count of active setups
 *
 * @example
 * ```tsx
 * const { notificationPermission, requestPermission } = useBackgroundAlerts(activeSetups, {
 *   ltpThreshold: 80,
 *   enableNotifications: true,
 *   enableTitleTicker: true,
 *   enableFaviconBadge: true,
 * });
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface Setup {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  status: 'forming' | 'ready' | 'triggered' | 'invalidated' | 'expired';
  ltpScore: number; // Combined LTP score (0-100)
  entry?: number;
  timestamp?: number;
}

export interface UseBackgroundAlertsOptions {
  /** LTP score threshold for "high quality" setup notifications (default: 80) */
  ltpThreshold?: number;
  /** Enable browser push notifications (default: true) */
  enableNotifications?: boolean;
  /** Enable tab title ticker animation (default: true) */
  enableTitleTicker?: boolean;
  /** Enable favicon badge updates (default: true) */
  enableFaviconBadge?: boolean;
  /** Ticker scroll speed in ms (default: 300) */
  tickerSpeed?: number;
  /** Sound notification for high-quality setups (default: false) */
  enableSound?: boolean;
}

export interface UseBackgroundAlertsReturn {
  /** Current notification permission status */
  notificationPermission: NotificationPermission | 'unsupported';
  /** Request notification permission from user */
  requestPermission: () => Promise<NotificationPermission | 'unsupported'>;
  /** Whether the tab is currently in background */
  isBackground: boolean;
  /** Manually send a test notification */
  sendTestNotification: () => void;
  /** Count of active high-quality setups */
  highQualityCount: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_OPTIONS: Required<UseBackgroundAlertsOptions> = {
  ltpThreshold: 80,
  enableNotifications: true,
  enableTitleTicker: true,
  enableFaviconBadge: true,
  tickerSpeed: 300,
  enableSound: false,
};

// Original favicon and title for restoration
let originalFavicon: string | null = null;
let originalTitle: string | null = null;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if browser supports notifications
 */
function supportsNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current notification permission
 */
function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!supportsNotifications()) return 'unsupported';
  return Notification.permission;
}

/**
 * Create a canvas-based favicon with a badge count
 */
function createBadgeFavicon(count: number, baseUrl?: string): string {
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  canvas.width = 32;
  canvas.height = 32;

  // Draw base favicon or default background
  if (baseUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = baseUrl;
    // For simplicity, we'll just draw a colored background
    // In production, you'd wait for img.onload
  }

  // Dark background
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, 32, 32);

  // Gold border
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 28, 28);

  // Badge circle (red)
  if (count > 0) {
    ctx.beginPath();
    ctx.arc(24, 8, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.fill();

    // Badge text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count > 9 ? '9+' : count.toString(), 24, 8);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Update the favicon in the document head
 */
function updateFavicon(dataUrl: string): void {
  if (typeof document === 'undefined') return;

  // Store original favicon if not already stored
  if (originalFavicon === null) {
    const existingLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    originalFavicon = existingLink?.href || '/favicon.ico';
  }

  // Find or create favicon link
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  link.href = dataUrl;
}

/**
 * Restore original favicon
 */
function restoreFavicon(): void {
  if (typeof document === 'undefined' || !originalFavicon) return;

  const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
  if (link) {
    link.href = originalFavicon;
  }
}

/**
 * Play notification sound
 */
function playNotificationSound(): void {
  if (typeof window === 'undefined') return;

  try {
    // Create a simple beep using Web Audio API
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch {
    // Audio not supported or blocked
  }
}

// =============================================================================
// Main Hook
// =============================================================================

export function useBackgroundAlerts(
  setups: Setup[],
  options: UseBackgroundAlertsOptions = {}
): UseBackgroundAlertsReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isBackground, setIsBackground] = useState(false);

  // Refs for cleanup and tracking
  const titleTickerRef = useRef<NodeJS.Timeout | null>(null);
  const tickerPositionRef = useRef(0);
  const notifiedSetupsRef = useRef<Set<string>>(new Set());
  const previousSetupsRef = useRef<Setup[]>([]);

  // Calculate high-quality setups
  const highQualitySetups = setups.filter(
    (s) => s.ltpScore >= opts.ltpThreshold && (s.status === 'ready' || s.status === 'forming')
  );
  const highQualityCount = highQualitySetups.length;

  // =========================================================================
  // Permission Management
  // =========================================================================

  const requestPermission = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    if (!supportsNotifications()) {
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    } catch {
      return 'denied';
    }
  }, []);

  // Initialize permission state
  useEffect(() => {
    setNotificationPermission(getNotificationPermission());
  }, []);

  // =========================================================================
  // Visibility Change Detection
  // =========================================================================

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsBackground(hidden);

      if (!hidden) {
        // Tab is now visible - restore original title and favicon
        if (originalTitle) {
          document.title = originalTitle;
          originalTitle = null;
        }
        restoreFavicon();

        // Clear ticker
        if (titleTickerRef.current) {
          clearInterval(titleTickerRef.current);
          titleTickerRef.current = null;
        }
      }
    };

    // Also listen for window focus/blur as a backup
    const handleFocus = () => {
      setIsBackground(false);
      if (originalTitle) {
        document.title = originalTitle;
        originalTitle = null;
      }
      restoreFavicon();
      if (titleTickerRef.current) {
        clearInterval(titleTickerRef.current);
        titleTickerRef.current = null;
      }
    };

    const handleBlur = () => {
      setIsBackground(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Initial state
    setIsBackground(document.hidden);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // =========================================================================
  // Browser Notifications
  // =========================================================================

  useEffect(() => {
    if (!opts.enableNotifications) return;
    if (notificationPermission !== 'granted') return;
    if (!isBackground) return;

    // Find new high-quality setups that we haven't notified about
    const newSetups = highQualitySetups.filter((setup) => {
      // Check if this is a genuinely new setup
      const wasInPrevious = previousSetupsRef.current.some(
        (prev) => prev.id === setup.id && prev.status === setup.status
      );
      const alreadyNotified = notifiedSetupsRef.current.has(setup.id);

      return !wasInPrevious && !alreadyNotified;
    });

    // Send notifications for new setups
    newSetups.forEach((setup) => {
      const directionEmoji = setup.direction === 'long' ? '📈' : '📉';
      const notification = new Notification(`${directionEmoji} ${setup.symbol} Setup Ready!`, {
        body: `LTP Score: ${setup.ltpScore}% | ${setup.direction.toUpperCase()}${setup.entry ? ` @ $${setup.entry.toFixed(2)}` : ''}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: setup.id, // Prevents duplicate notifications
        requireInteraction: false,
        silent: !opts.enableSound,
      });

      // Handle click - focus window
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Track that we've notified about this setup
      notifiedSetupsRef.current.add(setup.id);

      // Play sound if enabled
      if (opts.enableSound) {
        playNotificationSound();
      }
    });

    // Update previous setups reference
    previousSetupsRef.current = [...setups];

    // Cleanup old notified IDs (remove setups that are no longer in the list)
    const currentIds = new Set(setups.map((s) => s.id));
    notifiedSetupsRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        notifiedSetupsRef.current.delete(id);
      }
    });
  }, [setups, highQualitySetups, isBackground, notificationPermission, opts.enableNotifications, opts.enableSound]);

  // =========================================================================
  // Tab Title Ticker
  // =========================================================================

  useEffect(() => {
    if (!opts.enableTitleTicker) return;
    if (!isBackground) return;
    if (highQualityCount === 0) return;
    if (typeof document === 'undefined') return;

    // Store original title
    if (originalTitle === null) {
      originalTitle = document.title;
    }

    // Build ticker text
    const tickerItems = highQualitySetups
      .slice(0, 3) // Limit to 3 setups
      .map((s) => `⚡ ${s.symbol} ${s.direction.toUpperCase()} (${s.ltpScore}%)`)
      .join(' | ');

    const tickerText = `${tickerItems} | `;
    const fullTicker = tickerText.repeat(2); // Duplicate for seamless scrolling

    // Start ticker animation
    const animate = () => {
      const displayLength = 30;
      const start = tickerPositionRef.current % tickerText.length;
      const displayText = fullTicker.substring(start, start + displayLength);

      document.title = displayText;
      tickerPositionRef.current++;
    };

    // Initial update
    animate();

    // Set interval for scrolling
    titleTickerRef.current = setInterval(animate, opts.tickerSpeed);

    return () => {
      if (titleTickerRef.current) {
        clearInterval(titleTickerRef.current);
        titleTickerRef.current = null;
      }
    };
  }, [isBackground, highQualitySetups, highQualityCount, opts.enableTitleTicker, opts.tickerSpeed]);

  // =========================================================================
  // Favicon Badge
  // =========================================================================

  useEffect(() => {
    if (!opts.enableFaviconBadge) return;
    if (typeof document === 'undefined') return;

    if (isBackground && highQualityCount > 0) {
      // Create and set badge favicon
      const badgeFavicon = createBadgeFavicon(highQualityCount);
      if (badgeFavicon) {
        updateFavicon(badgeFavicon);
      }
    } else if (!isBackground) {
      // Restore original when tab is focused
      restoreFavicon();
    }
  }, [isBackground, highQualityCount, opts.enableFaviconBadge]);

  // =========================================================================
  // Test Notification
  // =========================================================================

  const sendTestNotification = useCallback(() => {
    if (notificationPermission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const notification = new Notification('🧪 Test Notification', {
      body: 'Background alerts are working! LTP Score: 85%',
      icon: '/favicon.ico',
      tag: 'test-notification',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    if (opts.enableSound) {
      playNotificationSound();
    }
  }, [notificationPermission, opts.enableSound]);

  // =========================================================================
  // Cleanup on Unmount
  // =========================================================================

  useEffect(() => {
    return () => {
      // Restore original title
      if (originalTitle && typeof document !== 'undefined') {
        document.title = originalTitle;
        originalTitle = null;
      }

      // Restore favicon
      restoreFavicon();

      // Clear ticker interval
      if (titleTickerRef.current) {
        clearInterval(titleTickerRef.current);
      }
    };
  }, []);

  return {
    notificationPermission,
    requestPermission,
    isBackground,
    sendTestNotification,
    highQualityCount,
  };
}

export default useBackgroundAlerts;

// =============================================================================
// Companion Component: NotificationPermissionBanner
// =============================================================================

/**
 * A ready-to-use banner component for requesting notification permissions
 *
 * @example
 * ```tsx
 * import { useBackgroundAlerts, NotificationPermissionBanner } from '@/hooks/useBackgroundAlerts';
 *
 * function CompanionMode({ setups }) {
 *   const alerts = useBackgroundAlerts(setups);
 *   return (
 *     <div>
 *       <NotificationPermissionBanner
 *         permission={alerts.notificationPermission}
 *         onRequestPermission={alerts.requestPermission}
 *       />
 *       ...
 *     </div>
 *   );
 * }
 * ```
 */
export interface NotificationPermissionBannerProps {
  permission: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
  className?: string;
}

// Note: The actual React component is in a separate file to avoid mixing hooks with components
// See: src/components/companion/notification-banner.tsx
