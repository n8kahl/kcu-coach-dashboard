'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { formatCurrency, getRelativeTime } from '@/lib/utils';

interface Alert {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  alertType: 'loading' | 'entering' | 'adding' | 'take_profit' | 'exiting' | 'stopped_out' | 'update';
  contract?: string;
  entryPrice?: number;
  stopLoss?: number;
  targets?: number[];
  message: string;
  ltpJustification?: string;
  createdAt: string;
  isActive: boolean;
  adminUsername: string;
  followCount: number;
  isFollowing?: boolean;
}

const alertTypeConfig = {
  loading: { label: 'Loading', icon: Clock, color: 'alert-loading' },
  entering: { label: 'Entering', icon: TrendingUp, color: 'alert-entering' },
  adding: { label: 'Adding', icon: Target, color: 'alert-adding' },
  take_profit: { label: 'Take Profit', icon: CheckCircle, color: 'alert-take-profit' },
  exiting: { label: 'Exiting', icon: XCircle, color: 'alert-exiting' },
  stopped_out: { label: 'Stopped Out', icon: AlertTriangle, color: 'alert-stopped-out' },
  update: { label: 'Update', icon: Bell, color: 'bg-gray-500/20 text-gray-400' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    // Mock data - would come from API/SSE in production
    const mockAlerts: Alert[] = [
      {
        id: '1',
        symbol: 'SPY',
        direction: 'long',
        alertType: 'entering',
        contract: 'SPY 450C 1/19',
        entryPrice: 2.45,
        stopLoss: 1.80,
        targets: [3.00, 3.50, 4.00],
        message: 'Entering SPY calls on the 21 EMA bounce with strong bid support',
        ltpJustification: 'Level: 21 EMA support | Trend: Uptrend intact | Patience: 3 green candles confirming bounce',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        isActive: true,
        adminUsername: 'Coach',
        followCount: 47,
        isFollowing: false,
      },
      {
        id: '2',
        symbol: 'NVDA',
        direction: 'long',
        alertType: 'take_profit',
        contract: 'NVDA 520C 1/19',
        entryPrice: 8.50,
        targets: [12.00],
        message: 'First target hit! Taking 50% off the table. Letting runners ride.',
        ltpJustification: 'Hit first resistance level. Trailing stop to breakeven.',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        isActive: true,
        adminUsername: 'Coach',
        followCount: 32,
        isFollowing: true,
      },
      {
        id: '3',
        symbol: 'TSLA',
        direction: 'short',
        alertType: 'loading',
        contract: 'TSLA 240P 1/19',
        message: 'Watching TSLA for a short setup. Approaching key resistance with weak momentum.',
        ltpJustification: 'Level: Daily resistance at 245 | Trend: Lower highs forming | Patience: Waiting for rejection candle',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        adminUsername: 'Coach',
        followCount: 28,
        isFollowing: false,
      },
    ];

    setAlerts(mockAlerts);
    setLoading(false);
  }, []);

  const handleFollow = async (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? { ...alert, isFollowing: !alert.isFollowing, followCount: alert.followCount + (alert.isFollowing ? -1 : 1) }
          : alert
      )
    );
  };

  const activeAlerts = alerts.filter((a) => a.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-accent-400" />
            Live Alerts
          </h1>
          <p className="text-gray-400">Real-time trade alerts from admin coaches</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={soundEnabled ? 'primary' : 'secondary'}
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-2"
          >
            <Volume2 className={`w-4 h-4 ${soundEnabled ? '' : 'opacity-50'}`} />
            {soundEnabled ? 'Sound On' : 'Sound Off'}
          </Button>
        </div>
      </div>

      {/* Active Alerts Count */}
      <div className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-white font-medium">
            {activeAlerts.length} Active {activeAlerts.length === 1 ? 'Alert' : 'Alerts'}
          </span>
        </div>
        <span className="text-sm text-gray-400">
          Auto-refreshing every 5 seconds
        </span>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="glass-card p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Loading alerts...</p>
          </div>
        ) : activeAlerts.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Bell className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No active alerts</h3>
            <p className="text-gray-400">
              Check back later for new trade alerts from the coaching team
            </p>
          </div>
        ) : (
          activeAlerts.map((alert) => {
            const config = alertTypeConfig[alert.alertType];
            const Icon = config.icon;

            return (
              <div key={alert.id} className="glass-card p-6 border-l-4 border-primary-500">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      alert.direction === 'long' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {alert.direction === 'long' ? (
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">{alert.symbol}</span>
                        <Badge variant={alert.direction === 'long' ? 'success' : 'error'}>
                          {alert.direction.toUpperCase()}
                        </Badge>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </div>
                      {alert.contract && (
                        <p className="text-sm text-gray-400">{alert.contract}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">{getRelativeTime(alert.createdAt)}</p>
                    <p className="text-xs text-gray-500">by {alert.adminUsername}</p>
                  </div>
                </div>

                {/* Message */}
                <p className="text-gray-100 mb-4">{alert.message}</p>

                {/* LTP Justification */}
                {alert.ltpJustification && (
                  <div className="bg-dark-bg/50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">LTP Analysis</p>
                    <p className="text-sm text-gray-300">{alert.ltpJustification}</p>
                  </div>
                )}

                {/* Trade Details */}
                {(alert.entryPrice || alert.stopLoss || alert.targets) && (
                  <div className="flex flex-wrap gap-4 mb-4 text-sm">
                    {alert.entryPrice && (
                      <div>
                        <span className="text-gray-500">Entry: </span>
                        <span className="text-white font-medium">{formatCurrency(alert.entryPrice)}</span>
                      </div>
                    )}
                    {alert.stopLoss && (
                      <div>
                        <span className="text-gray-500">Stop: </span>
                        <span className="text-red-400 font-medium">{formatCurrency(alert.stopLoss)}</span>
                      </div>
                    )}
                    {alert.targets && alert.targets.length > 0 && (
                      <div>
                        <span className="text-gray-500">Targets: </span>
                        <span className="text-green-400 font-medium">
                          {alert.targets.map((t) => formatCurrency(t)).join(' → ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-dark-border">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
