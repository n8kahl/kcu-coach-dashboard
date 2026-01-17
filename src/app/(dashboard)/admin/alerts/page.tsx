'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  Send,
  Target,
  Radio,
  TrendingUp,
  TrendingDown,
  Clock,
} from 'lucide-react';

const ALERT_TYPES = [
  { value: 'loading', label: 'Loading', emoji: '👀', description: 'Watching, not in yet', color: 'text-blue-400' },
  { value: 'entering', label: 'Entering', emoji: '🎯', description: 'Taking position', color: 'text-green-400' },
  { value: 'adding', label: 'Adding', emoji: '➕', description: 'Adding to position', color: 'text-cyan-400' },
  { value: 'take_profit', label: 'Take Profit', emoji: '💰', description: 'Partial exit', color: 'text-yellow-400' },
  { value: 'exiting', label: 'Exiting', emoji: '🚪', description: 'Full exit', color: 'text-purple-400' },
  { value: 'stopped_out', label: 'Stopped Out', emoji: '🚫', description: 'Hit stop loss', color: 'text-red-400' },
  { value: 'update', label: 'Update', emoji: '📝', description: 'General update', color: 'text-gray-400' }
];

interface AdminAlert {
  id: string;
  alert_type: string;
  symbol: string;
  direction: string;
  contract_details: string;
  entry_price: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  ltp_justification: string;
  coach_message: string;
  created_at: string;
  admin?: {
    discord_username: string;
    avatar_url: string;
  };
}

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [activeTrades, setActiveTrades] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [alertType, setAlertType] = useState('loading');
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [contractDetails, setContractDetails] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [target1, setTarget1] = useState('');
  const [target1Action, setTarget1Action] = useState('Take 50%');
  const [target2, setTarget2] = useState('');
  const [target2Action, setTarget2Action] = useState('Runner');
  const [ltpJustification, setLtpJustification] = useState('');
  const [levelDescription, setLevelDescription] = useState('');
  const [trendDescription, setTrendDescription] = useState('');
  const [patienceDescription, setPatienceDescription] = useState('');
  const [riskNotes, setRiskNotes] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [maxRisk, setMaxRisk] = useState('');
  const [coachMessage, setCoachMessage] = useState('');
  const [parentAlertId, setParentAlertId] = useState<string | null>(null);

  // Broadcast options
  const [broadcastDiscord, setBroadcastDiscord] = useState(true);
  const [broadcastWeb, setBroadcastWeb] = useState(true);

  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/admin/alerts?limit=20');
      const data = await res.json();
      setAlerts(data.alerts || []);
      setActiveTrades(data.activeTrades || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendAlert = async () => {
    if (!symbol.trim()) return;

    setSending(true);
    try {
      const res = await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertType,
          symbol: symbol.toUpperCase(),
          direction,
          contractDetails,
          entryPrice: entryPrice ? parseFloat(entryPrice) : null,
          stopLoss: stopLoss ? parseFloat(stopLoss) : null,
          target1: target1 ? parseFloat(target1) : null,
          target1Action,
          target2: target2 ? parseFloat(target2) : null,
          target2Action,
          ltpJustification,
          levelDescription,
          trendDescription,
          patienceDescription,
          riskNotes,
          positionSize,
          maxRisk,
          coachMessage,
          parentAlertId,
          broadcastDiscord,
          broadcastWeb
        })
      });

      if (res.ok) {
        // Reset form
        setSymbol('');
        setContractDetails('');
        setEntryPrice('');
        setStopLoss('');
        setTarget1('');
        setTarget2('');
        setLtpJustification('');
        setLevelDescription('');
        setTrendDescription('');
        setPatienceDescription('');
        setRiskNotes('');
        setPositionSize('');
        setMaxRisk('');
        setCoachMessage('');
        setParentAlertId(null);

        // Refresh alerts
        fetchAlerts();
      }
    } catch (error) {
      console.error('Error sending alert:', error);
    } finally {
      setSending(false);
    }
  };

  const selectActiveTrade = (trade: AdminAlert) => {
    setSymbol(trade.symbol);
    setDirection(trade.direction as 'long' | 'short');
    setContractDetails(trade.contract_details || '');
    setEntryPrice(trade.entry_price?.toString() || '');
    setStopLoss(trade.stop_loss?.toString() || '');
    setTarget1(trade.target_1?.toString() || '');
    setTarget2(trade.target_2?.toString() || '');
    setParentAlertId(trade.id);
  };

  const selectedType = ALERT_TYPES.find(t => t.value === alertType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Alert Panel
          </h1>
          <p className="text-gray-400">
            Broadcast trade alerts to the KCU community
          </p>
        </div>
        <Badge variant="warning" className="animate-pulse flex items-center gap-1">
          <Radio className="w-3 h-3" />
          BROADCAST READY
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Composer */}
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
            <Send className="w-5 h-5 text-primary-400" />
            Compose Alert
          </h2>

          <div className="space-y-6">
            {/* Alert Type Selection */}
            <div>
              <label className="text-sm font-medium text-gray-400 mb-2 block">
                Alert Type
              </label>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                {ALERT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setAlertType(type.value)}
                    className={cn(
                      'p-3 border rounded-lg text-center transition-all',
                      alertType === type.value
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-dark-border hover:border-gray-600'
                    )}
                  >
                    <div className="text-2xl mb-1">{type.emoji}</div>
                    <div className="text-xs text-gray-400">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Symbol & Direction */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 block">
                  Symbol
                </label>
                <Input
                  placeholder="NVDA"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="text-lg font-bold"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 block">
                  Direction
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDirection('long')}
                    className={cn(
                      'flex-1 py-3 border rounded-lg flex items-center justify-center gap-2 transition-all',
                      direction === 'long'
                        ? 'border-green-500 bg-green-500/10 text-green-500'
                        : 'border-dark-border text-gray-400'
                    )}
                  >
                    <TrendingUp className="w-5 h-5" />
                    LONG
                  </button>
                  <button
                    onClick={() => setDirection('short')}
                    className={cn(
                      'flex-1 py-3 border rounded-lg flex items-center justify-center gap-2 transition-all',
                      direction === 'short'
                        ? 'border-red-500 bg-red-500/10 text-red-500'
                        : 'border-dark-border text-gray-400'
                    )}
                  >
                    <TrendingDown className="w-5 h-5" />
                    SHORT
                  </button>
                </div>
              </div>
            </div>

            {/* Contract Details */}
            <div>
              <label className="text-sm font-medium text-gray-400 mb-2 block">
                Contract Details (optional)
              </label>
              <Input
                placeholder="NVDA 1/17 $950C @ $12.50"
                value={contractDetails}
                onChange={(e) => setContractDetails(e.target.value)}
              />
            </div>

            {/* Price Levels */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input
                label="Entry Price"
                type="number"
                step="0.01"
                placeholder="950.00"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
              />
              <Input
                label="Stop Loss"
                type="number"
                step="0.01"
                placeholder="947.50"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
              />
              <Input
                label="Target 1"
                type="number"
                step="0.01"
                placeholder="953.00"
                value={target1}
                onChange={(e) => setTarget1(e.target.value)}
              />
              <Input
                label="Target 2"
                type="number"
                step="0.01"
                placeholder="956.00"
                value={target2}
                onChange={(e) => setTarget2(e.target.value)}
              />
            </div>

            {/* LTP Justification */}
            <div>
              <label className="text-sm font-medium text-gray-400 mb-2 block">
                LTP Justification
              </label>
              <textarea
                className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg text-gray-100 resize-none focus:border-primary-500 outline-none"
                rows={2}
                placeholder="PDH at $950, bullish trend (above VWAP, HH/HL), 4-candle patience formation breaking out"
                value={ltpJustification}
                onChange={(e) => setLtpJustification(e.target.value)}
              />
            </div>

            {/* LTP Breakdown (collapsible) */}
            <details className="border border-dark-border rounded-lg p-4">
              <summary className="text-sm font-medium text-gray-400 cursor-pointer">
                LTP Breakdown (Optional)
              </summary>
              <div className="mt-4 space-y-4">
                <Input
                  placeholder="Level: PDH at $950"
                  value={levelDescription}
                  onChange={(e) => setLevelDescription(e.target.value)}
                />
                <Input
                  placeholder="Trend: Bullish (above VWAP, HH/HL on 5min)"
                  value={trendDescription}
                  onChange={(e) => setTrendDescription(e.target.value)}
                />
                <Input
                  placeholder="Patience: 4-candle consolidation breaking"
                  value={patienceDescription}
                  onChange={(e) => setPatienceDescription(e.target.value)}
                />
              </div>
            </details>

            {/* Risk Notes */}
            <div className="grid grid-cols-3 gap-4">
              <Input
                placeholder="Position size (e.g., 1 contract)"
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
              />
              <Input
                placeholder="Max risk (e.g., $250)"
                value={maxRisk}
                onChange={(e) => setMaxRisk(e.target.value)}
              />
              <Input
                placeholder="Risk notes"
                value={riskNotes}
                onChange={(e) => setRiskNotes(e.target.value)}
              />
            </div>

            {/* Coach Message */}
            <div>
              <label className="text-sm font-medium text-gray-400 mb-2 block">
                Coach Message (Educational note for the community)
              </label>
              <textarea
                className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg text-gray-100 resize-none focus:border-primary-500 outline-none"
                rows={2}
                placeholder="This is a textbook LTP setup. Notice how the patience candles formed right at PDH with decreasing volume..."
                value={coachMessage}
                onChange={(e) => setCoachMessage(e.target.value)}
              />
            </div>

            {/* Broadcast Options */}
            <div className="flex items-center gap-6 p-4 bg-dark-bg border border-dark-border rounded-lg">
              <span className="text-sm font-medium text-gray-400">Broadcast to:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastDiscord}
                  onChange={(e) => setBroadcastDiscord(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-white">Discord</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastWeb}
                  onChange={(e) => setBroadcastWeb(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-white">Web Push</span>
              </label>
            </div>

            {/* Parent Alert (for updates) */}
            {parentAlertId && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-between">
                <span className="text-sm text-blue-400">
                  Updating existing trade: {symbol}
                </span>
                <button
                  onClick={() => setParentAlertId(null)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Send Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={sendAlert}
              disabled={!symbol.trim() || sending}
            >
              {sending ? (
                <>
                  <Clock className="w-5 h-5 mr-2 animate-spin" />
                  Broadcasting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Broadcast {selectedType?.emoji} {selectedType?.label} Alert
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Active Trades */}
          <div className="glass-card p-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary-400" />
              Active Trades
            </h2>
            {activeTrades.length > 0 ? (
              <div className="space-y-2">
                {activeTrades.slice(0, 5).map((trade) => (
                  <button
                    key={trade.id}
                    onClick={() => selectActiveTrade(trade)}
                    className="w-full p-3 border border-dark-border hover:border-primary-500 rounded-lg text-left transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          {trade.symbol}
                        </span>
                        <Badge variant={trade.direction === 'long' ? 'success' : 'error'}>
                          {trade.direction.toUpperCase()}
                        </Badge>
                      </div>
                      <Badge>
                        {ALERT_TYPES.find(t => t.value === trade.alert_type)?.emoji}
                      </Badge>
                    </div>
                    {trade.entry_price && (
                      <div className="text-sm text-gray-500 mt-1">
                        Entry: ${trade.entry_price}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No active trades
              </p>
            )}
          </div>

          {/* Recent Alerts */}
          <div className="glass-card p-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-400" />
              Recent Alerts
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {alerts.slice(0, 10).map((alert) => {
                const type = ALERT_TYPES.find(t => t.value === alert.alert_type);
                return (
                  <div
                    key={alert.id}
                    className="p-2 border border-dark-border rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span>{type?.emoji}</span>
                      <span className="font-medium text-white">
                        {alert.symbol}
                      </span>
                      <span className={type?.color}>{type?.label}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alert Preview */}
          <div className="glass-card p-6">
            <h2 className="text-base font-semibold text-white mb-4">Preview</h2>
            <div className="p-4 bg-dark-bg border-l-4 border-primary-500 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{selectedType?.emoji}</span>
                <span className="font-bold text-white">
                  KCU ALERT: {selectedType?.label.toUpperCase()} {symbol || 'SYMBOL'}
                </span>
              </div>
              {symbol && (
                <>
                  <div className="text-sm text-gray-400 mb-2">
                    Kay is {selectedType?.description?.toLowerCase()} on {symbol} {direction}
                  </div>
                  {entryPrice && (
                    <div className="text-sm">
                      <span className="text-gray-500">Entry: </span>
                      <span className="text-white">${entryPrice}</span>
                    </div>
                  )}
                  {stopLoss && (
                    <div className="text-sm">
                      <span className="text-gray-500">Stop: </span>
                      <span className="text-red-500">${stopLoss}</span>
                    </div>
                  )}
                  {target1 && (
                    <div className="text-sm">
                      <span className="text-gray-500">Target: </span>
                      <span className="text-green-500">${target1}</span>
                    </div>
                  )}
                  {coachMessage && (
                    <div className="text-sm text-gray-400 mt-2 italic">
                      💡 &quot;{coachMessage}&quot;
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
