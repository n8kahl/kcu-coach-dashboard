'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  UserPlus,
  Volume2,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, getRelativeTime } from '@/lib/utils';
import type { AdminAlert } from '@/types';

interface DisplayAlert extends AdminAlert {
  adminUsername: string;
  followCount: number;
  isFollowing?: boolean;
}

const alertTypeConfig = {
  loading: { label: 'Loading', icon: Clock, color: 'bg-blue-500/20 text-blue-400' },
  entering: { label: 'Entering', icon: TrendingUp, color: 'bg-green-500/20 text-green-400' },
  adding: { label: 'Adding', icon: Target, color: 'bg-purple-500/20 text-purple-400' },
  take_profit: { label: 'Take Profit', icon: CheckCircle, color: 'bg-emerald-500/20 text-emerald-400' },
  exiting: { label: 'Exiting', icon: XCircle, color: 'bg-orange-500/20 text-orange-400' },
  stopped_out: { label: 'Stopped Out', icon: AlertTriangle, color: 'bg-red-500/20 text-red-400' },
  update: { label: 'Update', icon: Bell, color: 'bg-gray-500/20 text-gray-400' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<DisplayAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial alerts
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/admin/alerts');
      if (!res.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await res.json();
      const displayAlerts: DisplayAlert[] = (data.alerts || []).map((alert: AdminAlert) => ({
        ...alert,
        adminUsername: 'Coach',
        followCount: Math.floor(Math.random() * 50) + 10,
        isFollowing: false,
      }));

      setAlerts(displayAlerts);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect to SSE stream for real-time updates
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/admin/alerts/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connected');
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'new_alert') {
          const newAlert: DisplayAlert = {
            ...data.alert,
            adminUsername: 'Coach',
            followCount: 0,
            isFollowing: false,
          };

          setAlerts((prev) => [newAlert, ...prev]);

          // Play sound if enabled
          if (soundEnabled) {
            const audio = new Audio('/sounds/alert.mp3');
            audio.play().catch(() => {});
          }
        } else if (data.type === 'update_alert') {
          setAlerts((prev) =>
            prev.map((alert) =>
              alert.id === data.alert.id
                ? { ...alert, ...data.alert }
                : alert
            )
          );
        } else if (data.type === 'ping') {
          // Keep-alive ping, do nothing
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      console.log('SSE connection error');
      setConnected(false);
      eventSource.close();

      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connectSSE();
      }, 5000);
    };
  }, [soundEnabled]);

  // Initial fetch and SSE connection
  useEffect(() => {
    fetchAlerts();
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchAlerts, connectSSE]);

  const handleFollow = async (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              isFollowing: !alert.isFollowing,
              followCount: alert.followCount + (alert.isFollowing ? -1 : 1),
            }
          : alert
      )
    );
  };

  const activeAlerts = alerts.filter((a) => a.is_active);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Bell className="w-6 h-6 text-[var(--accent-primary)]" />
            Live Alerts
          </h1>
          <p className="text-[var(--text-tertiary)]">Real-time trade alerts from admin coaches</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={soundEnabled ? 'primary' : 'secondary'}
            onClick={() => setSoundEnabled(!soundEnabled)}
            icon={<Volume2 className={`w-4 h-4 ${soundEnabled ? '' : 'opacity-50'}`} />}
          >
            {soundEnabled ? 'Sound On' : 'Sound Off'}
          </Button>
          <Button
            variant="secondary"
            onClick={fetchAlerts}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {connected ? (
                <>
                  <Wifi className="w-4 h-4 text-[var(--profit)]" />
                  <div className="w-2 h-2 rounded-full bg-[var(--profit)] animate-pulse" />
                  <span className="text-[var(--text-primary)] font-medium">
                    Live - {activeAlerts.length} Active {activeAlerts.length === 1 ? 'Alert' : 'Alerts'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-[var(--loss)]" />
                  <span className="text-[var(--text-tertiary)]">
                    Disconnected - Reconnecting...
                  </span>
                </>
              )}
            </div>
            <span className="text-sm text-[var(--text-tertiary)]">
              Real-time updates enabled
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-[var(--loss)]">
          <CardContent>
            <p className="text-[var(--loss)] text-center py-4">{error}</p>
            <div className="flex justify-center">
              <Button variant="secondary" onClick={fetchAlerts}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)] mx-auto mb-4" />
              <p className="text-[var(--text-tertiary)]">Loading alerts...</p>
            </CardContent>
          </Card>
        ) : activeAlerts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No active alerts</h3>
              <p className="text-[var(--text-tertiary)]">
                Check back later for new trade alerts from the coaching team
              </p>
            </CardContent>
          </Card>
        ) : (
          activeAlerts.map((alert) => {
            const config = alertTypeConfig[alert.alert_type];
            const Icon = config.icon;

            return (
              <Card key={alert.id} className="border-l-4 border-l-[var(--accent-primary)]">
                <CardContent>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        alert.direction === 'long' ? 'bg-[var(--profit)]/20' : 'bg-[var(--loss)]/20'
                      }`}>
                        {alert.direction === 'long' ? (
                          <TrendingUp className="w-5 h-5 text-[var(--profit)]" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-[var(--loss)]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-[var(--text-primary)]">{alert.symbol}</span>
                          <Badge variant={alert.direction === 'long' ? 'success' : 'error'}>
                            {alert.direction.toUpperCase()}
                          </Badge>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </div>
                        {alert.contract && (
                          <p className="text-sm text-[var(--text-tertiary)]">{alert.contract}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--text-tertiary)]">{getRelativeTime(alert.created_at)}</p>
                      <p className="text-xs text-[var(--text-muted)]">by {alert.adminUsername}</p>
                    </div>
                  </div>

                  {/* Message */}
                  <p className="text-[var(--text-secondary)] mb-4">{alert.message}</p>

                  {/* LTP Justification */}
                  {alert.ltp_justification && (
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 mb-4">
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">LTP Analysis</p>
                      <p className="text-sm text-[var(--text-secondary)]">{alert.ltp_justification}</p>
                    </div>
                  )}

                  {/* Trade Details */}
                  {(alert.entry_price || alert.stop_loss || alert.targets) && (
                    <div className="flex flex-wrap gap-4 mb-4 text-sm">
                      {alert.entry_price && (
                        <div>
                          <span className="text-[var(--text-muted)]">Entry: </span>
                          <span className="text-[var(--text-primary)] font-medium">{formatCurrency(alert.entry_price)}</span>
                        </div>
                      )}
                      {alert.stop_loss && (
                        <div>
                          <span className="text-[var(--text-muted)]">Stop: </span>
                          <span className="text-[var(--loss)] font-medium">{formatCurrency(alert.stop_loss)}</span>
                        </div>
                      )}
                      {alert.targets && alert.targets.length > 0 && (
                        <div>
                          <span className="text-[var(--text-muted)]">Targets: </span>
                          <span className="text-[var(--profit)] font-medium">
                            {alert.targets.map((t) => formatCurrency(t)).join(' → ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-[var(--border-primary)]">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                      <UserPlus className="w-4 h-4" />
                      <span>{alert.followCount} following</span>
                    </div>
                    <Button
                      variant={alert.isFollowing ? 'secondary' : 'primary'}
                      onClick={() => handleFollow(alert.id)}
                    >
                      {alert.isFollowing ? 'Following' : 'Follow Trade'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
