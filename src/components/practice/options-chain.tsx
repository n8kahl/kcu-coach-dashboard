'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { estimateOptionGreeks } from '@/lib/practice/paper-trading';
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface OptionContract {
  strike: number;
  expiration: string;
  putCall: 'call' | 'put';
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number; // Implied Volatility
  inTheMoney: boolean;
}

interface OptionsChainProps {
  symbol: string;
  currentPrice: number;
  expirations?: string[]; // Available expiration dates
  onOptionSelect?: (option: OptionContract) => void;
  className?: string;
}

// Generate synthetic options data based on underlying price
function generateOptionsChain(
  symbol: string,
  currentPrice: number,
  expiration: string
): { calls: OptionContract[]; puts: OptionContract[] } {
  const strikes: number[] = [];
  const baseStrike = Math.round(currentPrice);
  const daysToExpiry = getDaysToExpiry(expiration);

  // Generate strikes around current price
  for (let i = -10; i <= 10; i++) {
    const strikeIncrement = currentPrice > 100 ? 5 : currentPrice > 50 ? 2.5 : 1;
    const strike = baseStrike + i * strikeIncrement;
    if (strike > 0) {
      strikes.push(strike);
    }
  }

  const calls: OptionContract[] = [];
  const puts: OptionContract[] = [];

  strikes.forEach((strike) => {
    const moneyness = currentPrice / strike;
    const iv = generateIV(moneyness, daysToExpiry);

    // Estimate option prices using simplified model
    const callPrice = estimateOptionPrice(
      currentPrice,
      strike,
      daysToExpiry,
      iv,
      'call'
    );
    const putPrice = estimateOptionPrice(
      currentPrice,
      strike,
      daysToExpiry,
      iv,
      'put'
    );

    // Get Greeks
    const callGreeks = estimateOptionGreeks({
      stockPrice: currentPrice,
      strikePrice: strike,
      daysToExpiry,
      volatility: iv,
      riskFreeRate: 0.05,
      putCall: 'call',
    });

    const putGreeks = estimateOptionGreeks({
      stockPrice: currentPrice,
      strikePrice: strike,
      daysToExpiry,
      volatility: iv,
      riskFreeRate: 0.05,
      putCall: 'put',
    });

    // Add spread for bid/ask
    const spread = Math.max(0.01, callPrice * 0.05);

    calls.push({
      strike,
      expiration,
      putCall: 'call',
      bid: Math.max(0.01, callPrice - spread / 2),
      ask: callPrice + spread / 2,
      last: callPrice,
      volume: Math.floor(Math.random() * 5000) + 100,
      openInterest: Math.floor(Math.random() * 10000) + 500,
      delta: callGreeks.delta,
      gamma: callGreeks.gamma,
      theta: callGreeks.theta,
      vega: callGreeks.vega,
      iv: iv * 100,
      inTheMoney: currentPrice > strike,
    });

    puts.push({
      strike,
      expiration,
      putCall: 'put',
      bid: Math.max(0.01, putPrice - spread / 2),
      ask: putPrice + spread / 2,
      last: putPrice,
      volume: Math.floor(Math.random() * 4000) + 100,
      openInterest: Math.floor(Math.random() * 8000) + 500,
      delta: putGreeks.delta,
      gamma: putGreeks.gamma,
      theta: putGreeks.theta,
      vega: putGreeks.vega,
      iv: iv * 100,
      inTheMoney: currentPrice < strike,
    });
  });

  return { calls, puts };
}

// Get days to expiration
function getDaysToExpiry(expiration: string): number {
  const expDate = new Date(expiration);
  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();
  return Math.max(0.1, diffMs / (1000 * 60 * 60 * 24)); // Minimum 0.1 days
}

// Generate IV based on moneyness and time
function generateIV(moneyness: number, daysToExpiry: number): number {
  // IV smile - higher IV for OTM options
  const baseIV = 0.25; // 25% base IV
  const moneynessFactor = Math.pow(Math.abs(1 - moneyness) * 3, 2) * 0.1;
  const timeFactor = daysToExpiry < 1 ? 0.1 : 0; // Higher IV for 0DTE
  return baseIV + moneynessFactor + timeFactor;
}

// Simplified Black-Scholes approximation
function estimateOptionPrice(
  stockPrice: number,
  strike: number,
  daysToExpiry: number,
  iv: number,
  putCall: 'call' | 'put'
): number {
  const T = daysToExpiry / 365;
  const intrinsicValue =
    putCall === 'call'
      ? Math.max(0, stockPrice - strike)
      : Math.max(0, strike - stockPrice);

  // Time value approximation
  const timeValue = stockPrice * iv * Math.sqrt(T) * 0.4;

  // ATM options have most time value
  const moneyness = stockPrice / strike;
  const atmFactor =
    1 - Math.min(1, Math.abs(1 - moneyness) * 5);

  return Math.max(0.01, intrinsicValue + timeValue * atmFactor);
}

// Get available expirations (0DTE, weeklies, monthlies)
function getDefaultExpirations(): string[] {
  const expirations: string[] = [];
  const today = new Date();

  // 0DTE (today)
  expirations.push(today.toISOString().split('T')[0]);

  // Tomorrow
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  expirations.push(tomorrow.toISOString().split('T')[0]);

  // This week's Friday
  const friday = new Date(today);
  friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7 || 7));
  if (friday > today) {
    expirations.push(friday.toISOString().split('T')[0]);
  }

  // Next week's Friday
  const nextFriday = new Date(friday);
  nextFriday.setDate(nextFriday.getDate() + 7);
  expirations.push(nextFriday.toISOString().split('T')[0]);

  // End of month
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  expirations.push(endOfMonth.toISOString().split('T')[0]);

  return Array.from(new Set(expirations)).sort();
}

export function OptionsChain({
  symbol,
  currentPrice,
  expirations: propExpirations,
  onOptionSelect,
  className,
}: OptionsChainProps) {
  const expirations = propExpirations || getDefaultExpirations();
  const [selectedExpiration, setSelectedExpiration] = useState(expirations[0]);
  const [showCalls, setShowCalls] = useState(true);
  const [showPuts, setShowPuts] = useState(true);
  const [sortBy, setSortBy] = useState<'strike' | 'volume' | 'delta'>('strike');
  const [showGreeks, setShowGreeks] = useState(true);

  // Generate options chain
  const { calls, puts } = useMemo(
    () => generateOptionsChain(symbol, currentPrice, selectedExpiration),
    [symbol, currentPrice, selectedExpiration]
  );

  // Sort options
  const sortedCalls = useMemo(() => {
    const sorted = [...calls];
    switch (sortBy) {
      case 'volume':
        return sorted.sort((a, b) => b.volume - a.volume);
      case 'delta':
        return sorted.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      default:
        return sorted.sort((a, b) => a.strike - b.strike);
    }
  }, [calls, sortBy]);

  const sortedPuts = useMemo(() => {
    const sorted = [...puts];
    switch (sortBy) {
      case 'volume':
        return sorted.sort((a, b) => b.volume - a.volume);
      case 'delta':
        return sorted.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      default:
        return sorted.sort((a, b) => a.strike - b.strike);
    }
  }, [puts, sortBy]);

  // Format expiration display
  const formatExpiration = (exp: string) => {
    const date = new Date(exp);
    const today = new Date();
    const days = Math.ceil(
      (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days === 0) return '0DTE';
    if (days === 1) return '1DTE';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleOptionClick = useCallback(
    (option: OptionContract) => {
      onOptionSelect?.(option);
    },
    [onOptionSelect]
  );

  return (
    <div
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Options Chain
            </h3>
            <span className="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]">
              {symbol}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <Clock className="w-3.5 h-3.5" />
            {formatExpiration(selectedExpiration)}
          </div>
        </div>

        {/* Expiration Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {expirations.map((exp) => (
            <button
              key={exp}
              onClick={() => setSelectedExpiration(exp)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors',
                selectedExpiration === exp
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
              )}
            >
              {formatExpiration(exp)}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-2 border-b border-[var(--border-primary)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showCalls}
              onChange={(e) => setShowCalls(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs text-green-400">Calls</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showPuts}
              onChange={(e) => setShowPuts(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs text-red-400">Puts</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showGreeks}
              onChange={(e) => setShowGreeks(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs text-[var(--text-tertiary)]">Greeks</span>
          </label>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'strike' | 'volume' | 'delta')}
          className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1"
        >
          <option value="strike">Sort by Strike</option>
          <option value="volume">Sort by Volume</option>
          <option value="delta">Sort by Delta</option>
        </select>
      </div>

      {/* Current Price Indicator */}
      <div className="px-4 py-2 bg-[var(--accent-primary)]/10 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-[var(--text-tertiary)]">Underlying:</span>
          <span className="font-bold text-[var(--accent-primary)]">
            ${currentPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Options Table */}
      <div className="max-h-[400px] overflow-y-auto">
        {/* Calls Section */}
        {showCalls && (
          <div>
            <div className="sticky top-0 bg-[var(--bg-tertiary)] px-4 py-2 flex items-center gap-2 border-b border-[var(--border-primary)]">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-green-400">CALLS</span>
            </div>
            <table className="w-full text-xs">
              <thead className="sticky top-8 bg-[var(--bg-secondary)]">
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="px-2 py-2 text-left text-[var(--text-tertiary)] font-medium">
                    Strike
                  </th>
                  <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                    Bid
                  </th>
                  <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                    Ask
                  </th>
                  <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                    Vol
                  </th>
                  {showGreeks && (
                    <>
                      <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                        Δ
                      </th>
                      <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                        θ
                      </th>
                      <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                        IV
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedCalls.map((option) => (
                  <tr
                    key={option.strike}
                    onClick={() => handleOptionClick(option)}
                    className={cn(
                      'border-b border-[var(--border-primary)] cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)]',
                      option.inTheMoney && 'bg-green-500/5'
                    )}
                  >
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          'font-medium',
                          option.inTheMoney
                            ? 'text-green-400'
                            : 'text-[var(--text-primary)]'
                        )}
                      >
                        ${option.strike.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[var(--text-secondary)]">
                      {option.bid.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[var(--text-secondary)]">
                      {option.ask.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right text-[var(--text-tertiary)]">
                      {option.volume.toLocaleString()}
                    </td>
                    {showGreeks && (
                      <>
                        <td className="px-2 py-2 text-right font-mono text-green-400">
                          {option.delta.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-red-400">
                          {option.theta.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right text-[var(--text-tertiary)]">
                          {option.iv.toFixed(1)}%
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Puts Section */}
        {showPuts && (
          <div>
            <div className="sticky top-0 bg-[var(--bg-tertiary)] px-4 py-2 flex items-center gap-2 border-b border-[var(--border-primary)]">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-red-400">PUTS</span>
            </div>
            <table className="w-full text-xs">
              <thead className="sticky top-8 bg-[var(--bg-secondary)]">
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="px-2 py-2 text-left text-[var(--text-tertiary)] font-medium">
                    Strike
                  </th>
                  <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                    Bid
                  </th>
                  <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                    Ask
                  </th>
                  <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                    Vol
                  </th>
                  {showGreeks && (
                    <>
                      <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                        Δ
                      </th>
                      <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                        θ
                      </th>
                      <th className="px-2 py-2 text-right text-[var(--text-tertiary)] font-medium">
                        IV
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedPuts.map((option) => (
                  <tr
                    key={option.strike}
                    onClick={() => handleOptionClick(option)}
                    className={cn(
                      'border-b border-[var(--border-primary)] cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)]',
                      option.inTheMoney && 'bg-red-500/5'
                    )}
                  >
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          'font-medium',
                          option.inTheMoney
                            ? 'text-red-400'
                            : 'text-[var(--text-primary)]'
                        )}
                      >
                        ${option.strike.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[var(--text-secondary)]">
                      {option.bid.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[var(--text-secondary)]">
                      {option.ask.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right text-[var(--text-tertiary)]">
                      {option.volume.toLocaleString()}
                    </td>
                    {showGreeks && (
                      <>
                        <td className="px-2 py-2 text-right font-mono text-red-400">
                          {option.delta.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-red-400">
                          {option.theta.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right text-[var(--text-tertiary)]">
                          {option.iv.toFixed(1)}%
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 0DTE Warning */}
      {getDaysToExpiry(selectedExpiration) < 1 && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-[var(--border-primary)] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400">
            0DTE options carry extreme risk. Time decay accelerates rapidly.
          </span>
        </div>
      )}
    </div>
  );
}

export default OptionsChain;
