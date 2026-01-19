'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  PaperTradingAccount,
  Position,
  Trade,
  AccountStats,
  createAccount,
  openPosition,
  closePosition,
  updatePositionPrice,
  checkExitConditions,
  calculateAccountStats,
  calculatePositionSize,
  formatCurrency,
  formatPercent,
  formatDuration,
  DEFAULT_STARTING_BALANCE,
} from '@/lib/practice/paper-trading';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertTriangle,
  History,
  BarChart2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface PaperTradingPanelProps {
  symbol: string;
  currentPrice: number;
  userId: string;
  onPositionChange?: (positions: Position[]) => void;
  className?: string;
}

type TabType = 'trade' | 'positions' | 'history' | 'stats';

export function PaperTradingPanel({
  symbol,
  currentPrice,
  userId,
  onPositionChange,
  className,
}: PaperTradingPanelProps) {
  // Account state
  const [account, setAccount] = useState<PaperTradingAccount>(() =>
    createAccount(userId)
  );
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('trade');
  const [showPanel, setShowPanel] = useState(true);

  // Order form state
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [positionSide, setPositionSide] = useState<'long' | 'short'>('long');
  const [quantity, setQuantity] = useState<number>(100);
  const [stopLoss, setStopLoss] = useState<number | undefined>();
  const [takeProfit, setTakeProfit] = useState<number | undefined>();
  const [riskPercent, setRiskPercent] = useState<number>(1);

  // Calculate stats
  const stats = calculateAccountStats(trades);

  // Update positions with current price
  useEffect(() => {
    if (positions.length > 0 && currentPrice > 0) {
      setPositions((prev) =>
        prev.map((pos) => {
          if (pos.symbol === symbol) {
            const updated = updatePositionPrice(pos, currentPrice);

            // Check exit conditions
            const { shouldExit, reason } = checkExitConditions(
              updated,
              currentPrice
            );
            if (shouldExit) {
              // Auto-close position
              const { trade, updatedAccount } = closePosition(
                account,
                updated,
                reason === 'stop_loss'
                  ? updated.stopLoss!
                  : updated.takeProfit!
              );
              setTrades((prev) => [...prev, trade]);
              setAccount(updatedAccount);
              return null as unknown as Position;
            }

            return updated;
          }
          return pos;
        }).filter(Boolean)
      );
    }
  }, [currentPrice, symbol, account, positions.length]);

  // Notify parent of position changes
  useEffect(() => {
    onPositionChange?.(positions);
  }, [positions, onPositionChange]);

  // Calculate position size based on risk
  const positionSizing = calculatePositionSize({
    accountBalance: account.balance,
    riskPercent,
    entryPrice: currentPrice,
    stopLoss: stopLoss || currentPrice * 0.98, // Default 2% stop
  });

  // Handle opening a position
  const handleOpenPosition = useCallback(() => {
    if (quantity <= 0 || currentPrice <= 0) return;

    const { position, updatedAccount, error } = openPosition(account, {
      symbol,
      type: 'stock',
      side: positionSide,
      quantity,
      price: currentPrice,
      stopLoss,
      takeProfit,
    });

    if (error) {
      alert(error);
      return;
    }

    setAccount(updatedAccount);
    setPositions((prev) => [...prev, position]);
    setActiveTab('positions');
  }, [account, symbol, positionSide, quantity, currentPrice, stopLoss, takeProfit]);

  // Handle closing a position
  const handleClosePosition = useCallback(
    (position: Position) => {
      const { trade, updatedAccount } = closePosition(
        account,
        position,
        currentPrice
      );

      setAccount(updatedAccount);
      setTrades((prev) => [...prev, trade]);
      setPositions((prev) => prev.filter((p) => p.id !== position.id));
    },
    [account, currentPrice]
  );

  // Reset account
  const handleResetAccount = useCallback(() => {
    if (
      confirm(
        'Reset your paper trading account? All positions and history will be cleared.'
      )
    ) {
      setAccount(createAccount(userId));
      setPositions([]);
      setTrades([]);
    }
  }, [userId]);

  // Quick quantity buttons
  const quickQuantities = [10, 25, 50, 100, 200];

  return (
    <div
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] cursor-pointer"
        onClick={() => setShowPanel(!showPanel)}
      >
        <div className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-[var(--accent-primary)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Paper Trading
            </h3>
            <p className="text-xs text-[var(--text-tertiary)]">
              {formatCurrency(account.balance)} Balance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {formatCurrency(account.equity)}
            </div>
            <div
              className={cn(
                'text-xs',
                account.equity >= DEFAULT_STARTING_BALANCE
                  ? 'text-green-400'
                  : 'text-red-400'
              )}
            >
              {formatPercent(
                ((account.equity - DEFAULT_STARTING_BALANCE) /
                  DEFAULT_STARTING_BALANCE) *
                  100
              )}
            </div>
          </div>
          {showPanel ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
          )}
        </div>
      </div>

      {showPanel && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-[var(--border-primary)]">
            {[
              { id: 'trade', label: 'Trade', icon: TrendingUp },
              {
                id: 'positions',
                label: `Positions (${positions.length})`,
                icon: Target,
              },
              { id: 'history', label: 'History', icon: History },
              { id: 'stats', label: 'Stats', icon: BarChart2 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Trade Tab */}
            {activeTab === 'trade' && (
              <div className="space-y-4">
                {/* Current Price */}
                <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded">
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {symbol} Current Price
                  </span>
                  <span className="text-lg font-bold text-[var(--text-primary)]">
                    {formatCurrency(currentPrice)}
                  </span>
                </div>

                {/* Side Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPositionSide('long')}
                    className={cn(
                      'py-2 rounded font-medium transition-colors',
                      positionSide === 'long'
                        ? 'bg-green-500 text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-green-500/20'
                    )}
                  >
                    <TrendingUp className="w-4 h-4 inline mr-1" />
                    Long
                  </button>
                  <button
                    onClick={() => setPositionSide('short')}
                    className={cn(
                      'py-2 rounded font-medium transition-colors',
                      positionSide === 'short'
                        ? 'bg-red-500 text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-red-500/20'
                    )}
                  >
                    <TrendingDown className="w-4 h-4 inline mr-1" />
                    Short
                  </button>
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                    Quantity
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, parseInt(e.target.value) || 0))
                      }
                      className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-sm text-[var(--text-primary)]"
                    />
                    <div className="flex gap-1">
                      {quickQuantities.map((q) => (
                        <button
                          key={q}
                          onClick={() => setQuantity(q)}
                          className={cn(
                            'px-2 py-1 text-xs rounded',
                            quantity === q
                              ? 'bg-[var(--accent-primary)] text-white'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-primary)]'
                          )}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stop Loss & Take Profit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                      Stop Loss
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={stopLoss || ''}
                      onChange={(e) =>
                        setStopLoss(
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                      placeholder={formatCurrency(currentPrice * 0.98)}
                      className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-sm text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                      Take Profit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={takeProfit || ''}
                      onChange={(e) =>
                        setTakeProfit(
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                      placeholder={formatCurrency(currentPrice * 1.02)}
                      className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {/* Position Sizing Calculator */}
                <div className="p-3 bg-[var(--bg-tertiary)] rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-tertiary)]">
                      Risk Calculator
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-tertiary)]">
                        Risk:
                      </span>
                      <select
                        value={riskPercent}
                        onChange={(e) =>
                          setRiskPercent(parseFloat(e.target.value))
                        }
                        className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1"
                      >
                        {[0.5, 1, 1.5, 2, 3, 5].map((p) => (
                          <option key={p} value={p}>
                            {p}%
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-[var(--text-tertiary)]">
                        Suggested Shares
                      </div>
                      <div className="font-medium text-[var(--text-primary)]">
                        {positionSizing.shares}
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--text-tertiary)]">
                        Risk Amount
                      </div>
                      <div className="font-medium text-[var(--text-primary)]">
                        {formatCurrency(positionSizing.riskAmount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--text-tertiary)]">
                        Position Value
                      </div>
                      <div className="font-medium text-[var(--text-primary)]">
                        {formatCurrency(positionSizing.positionValue)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setQuantity(positionSizing.shares)}
                    className="w-full text-xs py-1 text-[var(--accent-primary)] hover:underline"
                  >
                    Use Suggested Size
                  </button>
                </div>

                {/* Order Summary */}
                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[var(--text-tertiary)]">
                      Order Value
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {formatCurrency(quantity * currentPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-tertiary)]">
                      Buying Power
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {formatCurrency(account.buyingPower)}
                    </span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleOpenPosition}
                  disabled={
                    quantity <= 0 ||
                    quantity * currentPrice > account.buyingPower
                  }
                  className={cn(
                    'w-full py-3 rounded-lg font-bold text-white transition-colors',
                    positionSide === 'long'
                      ? 'bg-green-500 hover:bg-green-600 disabled:bg-green-500/50'
                      : 'bg-red-500 hover:bg-red-600 disabled:bg-red-500/50'
                  )}
                >
                  {positionSide === 'long' ? 'Buy' : 'Sell'} {quantity} {symbol}
                </button>
              </div>
            )}

            {/* Positions Tab */}
            {activeTab === 'positions' && (
              <div className="space-y-3">
                {positions.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-tertiary)]">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No open positions</p>
                  </div>
                ) : (
                  positions.map((position) => (
                    <div
                      key={position.id}
                      className="p-3 bg-[var(--bg-tertiary)] rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'px-2 py-0.5 text-xs font-medium rounded',
                              position.side === 'long'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {position.side.toUpperCase()}
                          </span>
                          <span className="font-medium text-[var(--text-primary)]">
                            {position.symbol}
                          </span>
                          <span className="text-sm text-[var(--text-tertiary)]">
                            x{position.quantity}
                          </span>
                        </div>
                        <button
                          onClick={() => handleClosePosition(position)}
                          className="px-3 py-1 text-xs font-medium bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
                        >
                          Close
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-[var(--text-tertiary)]">
                            Entry
                          </div>
                          <div className="font-medium">
                            {formatCurrency(position.entryPrice)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[var(--text-tertiary)]">
                            Current
                          </div>
                          <div className="font-medium">
                            {formatCurrency(position.currentPrice)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[var(--text-tertiary)]">P&L</div>
                          <div
                            className={cn(
                              'font-medium',
                              position.unrealizedPnL >= 0
                                ? 'text-green-400'
                                : 'text-red-400'
                            )}
                          >
                            {formatCurrency(position.unrealizedPnL)}
                            <span className="ml-1 text-[10px]">
                              ({formatPercent(position.unrealizedPnLPercent)})
                            </span>
                          </div>
                        </div>
                      </div>

                      {(position.stopLoss || position.takeProfit) && (
                        <div className="mt-2 pt-2 border-t border-[var(--border-primary)] flex gap-4 text-xs">
                          {position.stopLoss && (
                            <div className="flex items-center gap-1 text-red-400">
                              <AlertTriangle className="w-3 h-3" />
                              SL: {formatCurrency(position.stopLoss)}
                            </div>
                          )}
                          {position.takeProfit && (
                            <div className="flex items-center gap-1 text-green-400">
                              <Target className="w-3 h-3" />
                              TP: {formatCurrency(position.takeProfit)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-2">
                {trades.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-tertiary)]">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No trade history</p>
                  </div>
                ) : (
                  <>
                    {trades
                      .slice()
                      .reverse()
                      .map((trade) => (
                        <div
                          key={trade.id}
                          className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'text-xs font-medium',
                                  trade.side === 'long'
                                    ? 'text-green-400'
                                    : 'text-red-400'
                                )}
                              >
                                {trade.side.toUpperCase()}
                              </span>
                              <span className="text-sm font-medium text-[var(--text-primary)]">
                                {trade.symbol}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)]">
                              {formatCurrency(trade.entryPrice)} →{' '}
                              {formatCurrency(trade.exitPrice)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={cn(
                                'font-medium',
                                trade.realizedPnL >= 0
                                  ? 'text-green-400'
                                  : 'text-red-400'
                              )}
                            >
                              {formatCurrency(trade.realizedPnL)}
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)]">
                              {formatDuration(trade.holdingTimeMs)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </>
                )}
              </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
              <div className="space-y-4">
                {/* Main Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded">
                    <div className="text-xs text-[var(--text-tertiary)]">
                      Win Rate
                    </div>
                    <div className="text-xl font-bold text-[var(--text-primary)]">
                      {stats.winRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {stats.winningTrades}W / {stats.losingTrades}L
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded">
                    <div className="text-xs text-[var(--text-tertiary)]">
                      Profit Factor
                    </div>
                    <div className="text-xl font-bold text-[var(--text-primary)]">
                      {stats.profitFactor === Infinity
                        ? '∞'
                        : stats.profitFactor.toFixed(2)}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      Wins / Losses
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded">
                    <div className="text-xs text-[var(--text-tertiary)]">
                      Average Win
                    </div>
                    <div className="text-lg font-bold text-green-400">
                      {formatCurrency(stats.averageWin)}
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded">
                    <div className="text-xs text-[var(--text-tertiary)]">
                      Average Loss
                    </div>
                    <div className="text-lg font-bold text-red-400">
                      {formatCurrency(stats.averageLoss)}
                    </div>
                  </div>
                </div>

                {/* More Stats */}
                <div className="p-3 bg-[var(--bg-tertiary)] rounded space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-tertiary)]">
                      Total P&L
                    </span>
                    <span
                      className={cn(
                        'font-medium',
                        stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {formatCurrency(stats.totalPnL)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-tertiary)]">
                      Max Drawdown
                    </span>
                    <span className="font-medium text-red-400">
                      {stats.maxDrawdown.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-tertiary)]">
                      Avg R:R Ratio
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {stats.averageRR.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-tertiary)]">
                      Current Streak
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {stats.currentStreak} wins
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-tertiary)]">
                      Best Streak
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {stats.bestStreak} wins
                    </span>
                  </div>
                </div>

                {/* Reset Button */}
                <button
                  onClick={handleResetAccount}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset Account
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PaperTradingPanel;
