'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  SetupEvent,
  AdminAlertEvent,
  PriceUpdateEvent,
  LevelApproachEvent,
  CoachingUpdateEvent,
  CompanionMessageEvent,
} from '@/lib/broadcast';

// Re-export types for consumers of this hook
export type {
  SetupEvent,
  AdminAlertEvent,
  PriceUpdateEvent,
  LevelApproachEvent,
  CoachingUpdateEvent,
  CompanionMessageEvent,
};

// Connection events (not in broadcast.ts as they're SSE-specific)
export interface ConnectedEvent {
  userId: string;
  timestamp: string;
  message?: string;
  realtimeEnabled?: boolean;
  /** Broadcast mode: 'redis' = full multi-server, 'memory' = single server, 'unknown' = not yet initialized */
  mode?: 'redis' | 'memory' | 'unknown';
  /** Whether the broadcast system has initialized */
  initialized?: boolean;
  symbols?: string[];
}

/**
 * Connection status for UI display
 * - 'live': Redis pub/sub active, full realtime support
 * - 'degraded': Memory-only broadcast, polling recommended
 * - 'offline': Not connected or not initialized
 */
export type ConnectionStatus = 'live' | 'degraded' | 'offline';

export interface HeartbeatEvent {
  timestamp: string;
}

export type CompanionEvent =
  | { type: 'connected'; data: ConnectedEvent }
  | { type: 'heartbeat'; data: HeartbeatEvent }
  | { type: 'setup_forming'; data: SetupEvent }
  | { type: 'setup_ready'; data: SetupEvent }
  | { type: 'setup_triggered'; data: SetupEvent }
  | { type: 'admin_alert'; data: AdminAlertEvent }
  | { type: 'companion_message'; data: CompanionMessageEvent }
  | { type: 'price_update'; data: PriceUpdateEvent }
  | { type: 'level_approach'; data: LevelApproachEvent }
  | { type: 'coaching_update'; data: CoachingUpdateEvent };

interface UseCompanionStreamOptions {
  onEvent?: (event: CompanionEvent) => void;
  onSetupReady?: (setup: SetupEvent) => void;
  onAdminAlert?: (alert: AdminAlertEvent) => void;
  onCompanionMessage?: (message: CompanionMessageEvent) => void;
  onPriceUpdate?: (update: PriceUpdateEvent) => void;
  onLevelApproach?: (approach: LevelApproachEvent) => void;
  onCoachingUpdate?: (update: CoachingUpdateEvent) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useCompanionStream(options: UseCompanionStreamOptions = {}) {
  const {
    onEvent,
    onSetupReady,
    onAdminAlert,
    onCompanionMessage,
    onPriceUpdate,
    onLevelApproach,
    onCoachingUpdate,
    autoReconnect = true,
    reconnectInterval = 5000
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<CompanionEvent | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('offline');
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new EventSource
    const eventSource = new EventSource('/api/companion/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onerror = (e) => {
      setConnected(false);
      setError('Connection lost');
      setConnectionStatus('offline');
      setRealtimeEnabled(false);

      // Auto reconnect
      if (autoReconnect && !reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, reconnectInterval);
      }
    };

    // Handle different event types
    eventSource.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data) as ConnectedEvent;
      const event: CompanionEvent = { type: 'connected', data };
      setLastEvent(event);
      onEvent?.(event);

      // Update connection status based on mode
      setRealtimeEnabled(data.realtimeEnabled ?? false);
      if (!data.initialized) {
        setConnectionStatus('offline');
      } else if (data.mode === 'redis') {
        setConnectionStatus('live');
      } else {
        // 'memory' or 'unknown' mode = degraded
        setConnectionStatus('degraded');
      }
    });

    eventSource.addEventListener('heartbeat', (e) => {
      const data = JSON.parse(e.data);
      const event: CompanionEvent = { type: 'heartbeat', data };
      // Don't trigger onEvent for heartbeats to avoid noise
    });

    eventSource.addEventListener('setup_forming', (e) => {
      const data = JSON.parse(e.data);
      const event: CompanionEvent = { type: 'setup_forming', data };
      setLastEvent(event);
      onEvent?.(event);
    });

    eventSource.addEventListener('setup_ready', (e) => {
      const data = JSON.parse(e.data);
      const event: CompanionEvent = { type: 'setup_ready', data };
      setLastEvent(event);
      onEvent?.(event);
      onSetupReady?.(data);
    });

    eventSource.addEventListener('setup_triggered', (e) => {
      const data = JSON.parse(e.data);
      const event: CompanionEvent = { type: 'setup_triggered', data };
      setLastEvent(event);
      onEvent?.(event);
    });

    eventSource.addEventListener('admin_alert', (e) => {
      const data = JSON.parse(e.data);
      const event: CompanionEvent = { type: 'admin_alert', data };
      setLastEvent(event);
      onEvent?.(event);
      onAdminAlert?.(data);
    });

    eventSource.addEventListener('companion_message', (e) => {
      const data = JSON.parse(e.data);
      const event: CompanionEvent = { type: 'companion_message', data };
      setLastEvent(event);
      onEvent?.(event);
      onCompanionMessage?.(data);
    });

    eventSource.addEventListener('price_update', (e) => {
      const data = JSON.parse(e.data) as PriceUpdateEvent;
      const event: CompanionEvent = { type: 'price_update', data };
      setLastEvent(event);
      onEvent?.(event);
      onPriceUpdate?.(data);
    });

    eventSource.addEventListener('level_approach', (e) => {
      const data = JSON.parse(e.data) as LevelApproachEvent;
      const event: CompanionEvent = { type: 'level_approach', data };
      setLastEvent(event);
      onEvent?.(event);
      onLevelApproach?.(data);
    });

    eventSource.addEventListener('coaching_update', (e) => {
      const data = JSON.parse(e.data) as CoachingUpdateEvent;
      const event: CompanionEvent = { type: 'coaching_update', data };
      setLastEvent(event);
      onEvent?.(event);
      onCoachingUpdate?.(data);
    });
  }, [onEvent, onSetupReady, onAdminAlert, onCompanionMessage, onPriceUpdate, onLevelApproach, onCoachingUpdate, autoReconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnected(false);
    setConnectionStatus('offline');
    setRealtimeEnabled(false);
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected,
    error,
    lastEvent,
    /** Connection status: 'live' (Redis), 'degraded' (memory-only), 'offline' */
    connectionStatus,
    /** Whether realtime price updates are enabled (symbols registered + broadcast initialized) */
    realtimeEnabled,
    connect,
    disconnect
  };
}

// Hook for admin alert notifications
export function useAdminAlerts(callback?: (alert: AdminAlertEvent) => void) {
  const [alerts, setAlerts] = useState<AdminAlertEvent[]>([]);
  const [latestAlert, setLatestAlert] = useState<AdminAlertEvent | null>(null);

  useCompanionStream({
    onAdminAlert: (alert) => {
      setLatestAlert(alert);
      setAlerts((prev) => [alert, ...prev].slice(0, 50)); // Keep last 50
      callback?.(alert);

      // Play notification sound
      playNotificationSound(alert.alertType);

      // Show browser notification
      showBrowserNotification(alert);
    }
  });

  return { alerts, latestAlert };
}

// Helper to play notification sound
function playNotificationSound(alertType: string) {
  if (typeof window === 'undefined') return;

  // Create audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Different sounds for different alert types
  switch (alertType) {
    case 'entering':
      oscillator.frequency.value = 880; // A5
      oscillator.type = 'sine';
      break;
    case 'take_profit':
      oscillator.frequency.value = 1047; // C6
      oscillator.type = 'sine';
      break;
    case 'stopped_out':
      oscillator.frequency.value = 440; // A4
      oscillator.type = 'sawtooth';
      break;
    default:
      oscillator.frequency.value = 660; // E5
      oscillator.type = 'sine';
  }

  gainNode.gain.value = 0.1;

  oscillator.start();
  setTimeout(() => {
    oscillator.stop();
    audioContext.close();
  }, 200);
}

// Helper to show browser notification
async function showBrowserNotification(alert: AdminAlertEvent) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    const emoji = {
      loading: '👀',
      entering: '🎯',
      adding: '➕',
      take_profit: '💰',
      exiting: '🚪',
      stopped_out: '🚫',
      update: '📝'
    }[alert.alertType] || '📢';

    new Notification(`${emoji} KCU Alert: ${alert.symbol}`, {
      body: `${alert.alertType.replace('_', ' ').toUpperCase()} - ${alert.direction}`,
      icon: '/kcu-icon.png',
      tag: alert.id,
      requireInteraction: alert.alertType === 'entering' || alert.alertType === 'stopped_out'
    });
  } else if (Notification.permission !== 'denied') {
    await Notification.requestPermission();
  }
}
