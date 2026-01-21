'use client';

/**
 * useCompanionStream
 *
 * SSE hook for real-time companion mode updates.
 * Uses refs for callbacks to prevent stale closures when symbol changes.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export type CompanionEvent =
  | { type: 'connected'; data: { userId: string; timestamp: string } }
  | { type: 'heartbeat'; data: { timestamp: string } }
  | { type: 'setup_forming'; data: SetupEvent }
  | { type: 'setup_ready'; data: SetupEvent }
  | { type: 'setup_triggered'; data: SetupEvent }
  | { type: 'admin_alert'; data: AdminAlertEvent }
  | { type: 'companion_message'; data: CompanionMessageEvent }
  | { type: 'price_update'; data: PriceUpdateEvent }
  | { type: 'level_approach'; data: LevelApproachEvent }
  | { type: 'coaching_update'; data: CoachingUpdateEvent };

interface SetupEvent {
  id: string;
  symbol: string;
  direction: string;
  confluenceScore: number;
  coachNote: string;
  suggestedEntry?: number;
  suggestedStop?: number;
  target1?: number;
  target2?: number;
}

interface AdminAlertEvent {
  id: string;
  alertType: string;
  symbol: string;
  direction: string;
  entryPrice?: number;
  stopLoss?: number;
  target1?: number;
  coachMessage?: string;
  admin: {
    username: string;
    avatar?: string;
  };
}

interface CompanionMessageEvent {
  sessionId: string;
  messageType: 'info' | 'warning' | 'action' | 'milestone' | 'risk' | 'education';
  message: string;
  triggerType?: string;
  priceAtMessage?: number;
  pnlPercent?: number;
}

interface PriceUpdateEvent {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface LevelApproachEvent {
  symbol: string;
  levelType: string;
  levelPrice: number;
  currentPrice: number;
  distancePercent: number;
}

interface CoachingUpdateEvent {
  symbol: string;
  eventType: 'level_approach' | 'level_cross' | 'vwap_cross' | 'gamma_flip' |
             'r_milestone' | 'patience_forming' | 'patience_break';
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: {
    type: 'guidance' | 'warning' | 'opportunity';
    content: string;
    emoji?: string;
  };
  context: {
    currentPrice: number;
    relevantLevel?: number;
    direction?: 'bullish' | 'bearish';
  };
  timestamp: string;
}

interface UseCompanionStreamOptions {
  /** Optional symbol filter - only pass events for this symbol to callbacks */
  symbol?: string | null;
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

/**
 * Main SSE stream hook with stable callbacks via refs.
 * This prevents reconnecting when callbacks change (e.g., when symbol changes).
 */
export function useCompanionStream(options: UseCompanionStreamOptions = {}) {
  const {
    symbol,
    autoReconnect = true,
    reconnectInterval = 5000
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<CompanionEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Store callbacks in refs to avoid stale closures
  // This allows the SSE connection to stay open while callbacks update
  const callbackRefs = useRef({
    onEvent: options.onEvent,
    onSetupReady: options.onSetupReady,
    onAdminAlert: options.onAdminAlert,
    onCompanionMessage: options.onCompanionMessage,
    onPriceUpdate: options.onPriceUpdate,
    onLevelApproach: options.onLevelApproach,
    onCoachingUpdate: options.onCoachingUpdate,
    symbol: symbol,
  });

  // Update refs when callbacks/symbol change (no reconnect needed)
  useEffect(() => {
    callbackRefs.current = {
      onEvent: options.onEvent,
      onSetupReady: options.onSetupReady,
      onAdminAlert: options.onAdminAlert,
      onCompanionMessage: options.onCompanionMessage,
      onPriceUpdate: options.onPriceUpdate,
      onLevelApproach: options.onLevelApproach,
      onCoachingUpdate: options.onCoachingUpdate,
      symbol: symbol,
    };
  }, [options.onEvent, options.onSetupReady, options.onAdminAlert, options.onCompanionMessage, options.onPriceUpdate, options.onLevelApproach, options.onCoachingUpdate, symbol]);

  // Helper to check if event matches current symbol filter
  const shouldProcessEvent = useCallback((eventSymbol?: string): boolean => {
    const currentSymbol = callbackRefs.current.symbol;
    // If no symbol filter, process all events
    if (!currentSymbol) return true;
    // If event has a symbol, check if it matches
    if (eventSymbol) return eventSymbol === currentSymbol;
    // Events without symbols (like connected) always pass
    return true;
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new EventSource
    const eventSource = new EventSource('/api/companion/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (mountedRef.current) {
        setConnected(true);
        setError(null);
      }
    };

    eventSource.onerror = () => {
      if (mountedRef.current) {
        setConnected(false);
        setError('Connection lost');

        // Auto reconnect
        if (autoReconnect && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, reconnectInterval);
        }
      }
    };

    // Handle different event types - always read from refs for latest callbacks
    eventSource.addEventListener('connected', (e) => {
      try {
        const data = JSON.parse(e.data);
        const event: CompanionEvent = { type: 'connected', data };
        if (mountedRef.current) {
          setLastEvent(event);
          callbackRefs.current.onEvent?.(event);
        }
      } catch {}
    });

    eventSource.addEventListener('heartbeat', () => {
      // Heartbeats are silent - no callback trigger
    });

    eventSource.addEventListener('setup_forming', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!shouldProcessEvent(data.symbol)) return;
        const event: CompanionEvent = { type: 'setup_forming', data };
        if (mountedRef.current) {
          setLastEvent(event);
          callbackRefs.current.onEvent?.(event);
        }
      } catch {}
    });

    eventSource.addEventListener('setup_ready', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!shouldProcessEvent(data.symbol)) return;
        const event: CompanionEvent = { type: 'setup_ready', data };
        if (mountedRef.current) {
          setLastEvent(event);
          callbackRefs.current.onEvent?.(event);
          callbackRefs.current.onSetupReady?.(data);
        }
      } catch {}
    });

    eventSource.addEventListener('setup_triggered', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!shouldProcessEvent(data.symbol)) return;
        const event: CompanionEvent = { type: 'setup_triggered', data };
        if (mountedRef.current) {
          setLastEvent(event);
          callbackRefs.current.onEvent?.(event);
        }
      } catch {}
    });

    eventSource.addEventListener('admin_alert', (e) => {
      try {
        const data = JSON.parse(e.data);
        // Admin alerts always pass through (important for all symbols)
        const event: CompanionEvent = { type: 'admin_alert', data };
        if (mountedRef.current) {
          setLastEvent(event);
          callbackRefs.current.onEvent?.(event);
          callbackRefs.current.onAdminAlert?.(data);
        }
      } catch {}
    });

    eventSource.addEventListener('companion_message', (e) => {
      try {
        const data = JSON.parse(e.data);
        const event: CompanionEvent = { type: 'companion_message', data };
        if (mountedRef.current) {
          setLastEvent(event);
          callbackRefs.current.onEvent?.(event);
          callbackRefs.current.onCompanionMessage?.(data);
        }
      } catch {}
    });

    eventSource.addEventListener('price_update', (e) => {
      try {
        const data = JSON.parse(e.data) as PriceUpdateEvent;
        if (!shouldProcessEvent(data.symbol)) return;
        const event: CompanionEvent = { type: 'price_update', data };
        if (mountedRef.current) {
          setLastEvent(event);
          callbackRefs.current.onEvent?.(event);
          callbackRefs.current.onPriceUpdate?.(data);
        }
      } catch {}
    });

    eventSource.addEventListener('level_approach', (e) => {
      try {
        const data = JSON.parse(e.data) as LevelApproachEvent;
        if (!shouldProcessEvent(data.symbol)) return;
        const event: CompanionEvent = { type: 'level_approach', data };
        if (mountedRef.current) {
          setLastEvent(event);
          callbackRefs.current.onEvent?.(event);
          callbackRefs.current.onLevelApproach?.(data);
        }
      } catch {}
    });

    eventSource.addEventListener('coaching_update', (e) => {
      try {
        const data = JSON.parse(e.data) as CoachingUpdateEvent;
        if (!shouldProcessEvent(data.symbol)) return;
        const event: CompanionEvent = { type: 'coaching_update', data };
        if (mountedRef.current) {
          setLastEvent(event);
          callbackRefs.current.onEvent?.(event);
          callbackRefs.current.onCoachingUpdate?.(data);
        }
      } catch {}
    });
  }, [autoReconnect, reconnectInterval, shouldProcessEvent]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (mountedRef.current) {
      setConnected(false);
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected,
    error,
    lastEvent,
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

  try {
    // Create audio context
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
  } catch {}
}

// Helper to show browser notification
async function showBrowserNotification(alert: AdminAlertEvent) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  try {
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
  } catch {}
}
