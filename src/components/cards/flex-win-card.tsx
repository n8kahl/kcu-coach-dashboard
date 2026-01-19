'use client';

/**
 * FlexWinCard - Premium "Viral Marketing Asset" Win Card
 *
 * A dark mode cyberpunk/financial aesthetic card designed for social sharing.
 * Features:
 * - Big bold P&L display with neon glow
 * - "Verified by KCU Coach" holographic badge
 * - Mini sparkline chart showing trade execution
 * - High-res PNG export via html-to-image
 * - Explicit font loading for reliable exports
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Download,
  Twitter,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// =============================================================================
// Types
// =============================================================================

export interface FlexWinCardData {
  // Trade Info
  symbol: string;
  direction: 'long' | 'short';
  pnl: number;
  pnlPercent: number;
  entryPrice: number;
  exitPrice: number;
  // Optional
  ltpGrade?: string;
  ltpScore?: number;
  holdTime?: string;
  riskReward?: string;
  // Sparkline data (array of prices during trade)
  priceHistory?: number[];
  // User
  username: string;
  avatarUrl?: string;
  // Metadata
  timestamp?: Date;
  tradeId?: string;
}

interface FlexWinCardProps {
  data: FlexWinCardData;
  variant?: 'gold' | 'platinum' | 'diamond';
  showActions?: boolean;
  onExport?: () => void;
}

// =============================================================================
// Sparkline Component
// =============================================================================

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  isProfit: boolean;
}

function Sparkline({ data, width = 200, height = 60, isProfit }: SparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate SVG path
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 10) - 5;
    return { x, y };
  });

  const pathData = points
    .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
    .join(' ');

  // Gradient area
  const areaPath =
    pathData +
    ` L ${width},${height} L 0,${height} Z`;

  const gradientId = `sparkline-gradient-${isProfit ? 'profit' : 'loss'}`;
  const glowId = `sparkline-glow-${isProfit ? 'profit' : 'loss'}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        {/* Gradient fill */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop
            offset="0%"
            stopColor={isProfit ? '#22c55e' : '#ef4444'}
            stopOpacity="0.3"
          />
          <stop
            offset="100%"
            stopColor={isProfit ? '#22c55e' : '#ef4444'}
            stopOpacity="0"
          />
        </linearGradient>
        {/* Glow filter */}
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradientId})`} />

      {/* Main line with glow */}
      <path
        d={pathData}
        fill="none"
        stroke={isProfit ? '#22c55e' : '#ef4444'}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
      />

      {/* Entry point */}
      <circle
        cx={points[0].x}
        cy={points[0].y}
        r="4"
        fill="#0a0a0a"
        stroke={isProfit ? '#22c55e' : '#ef4444'}
        strokeWidth="2"
      />

      {/* Exit point */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="5"
        fill={isProfit ? '#22c55e' : '#ef4444'}
        className="animate-pulse"
      />
    </svg>
  );
}

// =============================================================================
// Verified Badge Component
// =============================================================================

function VerifiedBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 rounded-sm">
      <Shield className="w-3.5 h-3.5 text-amber-400" />
      <span
        className="text-[10px] font-semibold tracking-wider text-amber-400 uppercase"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        Verified by KCU
      </span>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function FlexWinCard({
  data,
  variant = 'gold',
  showActions = true,
  onExport,
}: FlexWinCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Ensure fonts are loaded before export
  useEffect(() => {
    // Wait for fonts to load
    if (document.fonts) {
      document.fonts.ready.then(() => {
        setFontsLoaded(true);
      });
    } else {
      // Fallback for older browsers
      setTimeout(() => setFontsLoaded(true), 1000);
    }
  }, []);

  const isProfit = data.pnl >= 0;

  // Variant styles
  const variantStyles = {
    gold: {
      accent: 'from-amber-400 to-yellow-500',
      glow: 'shadow-amber-500/20',
      border: 'border-amber-500/30',
      badge: 'bg-amber-500/10',
    },
    platinum: {
      accent: 'from-slate-300 to-slate-400',
      glow: 'shadow-slate-400/20',
      border: 'border-slate-400/30',
      badge: 'bg-slate-400/10',
    },
    diamond: {
      accent: 'from-cyan-400 to-blue-500',
      glow: 'shadow-cyan-500/20',
      border: 'border-cyan-500/30',
      badge: 'bg-cyan-500/10',
    },
  };

  const style = variantStyles[variant];

  // Generate mock price history if not provided
  const priceHistory = data.priceHistory || generateMockPriceHistory(
    data.entryPrice,
    data.exitPrice,
    20
  );

  /**
   * Export card as high-resolution PNG
   */
  const handleExport = useCallback(async () => {
    if (!cardRef.current || !fontsLoaded) return;
    setDownloading(true);

    try {
      // Wait a frame to ensure styles are applied
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 3, // High-res export (3x)
        backgroundColor: '#0a0a0a',
        style: {
          // Ensure consistent rendering
          transform: 'none',
        },
        // Filter out elements that shouldn't be in export
        filter: (node) => {
          const exclusionClasses = ['no-export'];
          return !exclusionClasses.some((c) =>
            node.classList?.contains(c)
          );
        },
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `kcu-win-${data.symbol}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      onExport?.();
    } catch (error) {
      console.error('Failed to export win card:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [fontsLoaded, data.symbol, onExport]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/share/win/${data.tradeId || 'preview'}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    const emoji = isProfit ? '🔥' : '📉';
    const pnlText = isProfit
      ? `+$${Math.abs(data.pnl).toLocaleString()}`
      : `-$${Math.abs(data.pnl).toLocaleString()}`;

    const text = `${emoji} ${data.symbol} ${data.direction.toUpperCase()} ${pnlText}

${data.ltpGrade ? `LTP Grade: ${data.ltpGrade}` : ''}
${data.riskReward ? `R:R ${data.riskReward}` : ''}

Verified by @KCUTrading Coach

#TradingWins #LTP #DayTrading #Options`;

    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* The Flex Card */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'relative w-[420px] overflow-hidden',
          // Deep black background
          'bg-[#0a0a0a]',
          // Gold accent border with glow
          'border',
          style.border,
          `shadow-2xl ${style.glow}`,
          // Sharp corners for cyberpunk feel
          'rounded-none'
        )}
        style={{
          // Explicit font family for export reliability
          fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
        }}
      >
        {/* Scan Lines Overlay (Cyberpunk Effect) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.1) 1px, rgba(255,255,255,0.1) 2px)',
          }}
        />

        {/* Top Gradient Bar */}
        <div className={cn('h-1 w-full bg-gradient-to-r', style.accent)} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800/50">
          <div className="flex items-center gap-2">
            <div className={cn('w-8 h-8 flex items-center justify-center', style.badge)}>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span
                className="text-[10px] font-bold tracking-[0.2em] text-amber-400 uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                KCU TRADING
              </span>
              <div className="text-[9px] text-neutral-500 tracking-wider">VERIFIED WIN</div>
            </div>
          </div>
          <VerifiedBadge />
        </div>

        {/* Main Content */}
        <div className="px-5 py-6">
          {/* Symbol & Direction */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-black text-white tracking-tight">
              {data.symbol}
            </span>
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase tracking-wider',
                data.direction === 'long'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              )}
            >
              {data.direction === 'long' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {data.direction}
            </div>
          </div>

          {/* P&L - THE FLEX */}
          <div className="relative my-6">
            {/* Glow effect behind P&L */}
            <div
              className={cn(
                'absolute inset-0 blur-3xl opacity-30',
                isProfit ? 'bg-emerald-500' : 'bg-red-500'
              )}
            />
            <div
              className={cn(
                'relative text-center',
                isProfit ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {/* P&L Number */}
              <div
                className="text-6xl font-black tracking-tight"
                style={{
                  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                  textShadow: isProfit
                    ? '0 0 40px rgba(34, 197, 94, 0.5), 0 0 80px rgba(34, 197, 94, 0.3)'
                    : '0 0 40px rgba(239, 68, 68, 0.5), 0 0 80px rgba(239, 68, 68, 0.3)',
                }}
              >
                {isProfit ? '+' : '-'}${Math.abs(data.pnl).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              {/* Percent Change */}
              <div
                className="text-xl font-bold mt-1 opacity-80"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                ({isProfit ? '+' : ''}{data.pnlPercent.toFixed(2)}%)
              </div>
            </div>
          </div>

          {/* Sparkline Chart */}
          <div className="relative bg-neutral-900/50 border border-neutral-800 p-4 mb-6">
            <div className="absolute top-2 left-2 text-[9px] text-neutral-500 uppercase tracking-wider">
              Trade Execution
            </div>
            <div className="flex justify-center mt-2">
              <Sparkline data={priceHistory} width={320} height={70} isProfit={isProfit} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-neutral-500">
              <span>Entry: ${data.entryPrice.toFixed(2)}</span>
              <span>Exit: ${data.exitPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {data.ltpGrade && (
              <StatBox
                label="LTP Grade"
                value={data.ltpGrade}
                highlight={['A', 'A+', 'A-'].includes(data.ltpGrade)}
              />
            )}
            {data.riskReward && (
              <StatBox label="R:R" value={data.riskReward} />
            )}
            {data.holdTime && (
              <StatBox label="Hold Time" value={data.holdTime} />
            )}
            {!data.ltpGrade && !data.riskReward && !data.holdTime && (
              <>
                <StatBox label="Entry" value={`$${data.entryPrice.toFixed(2)}`} />
                <StatBox label="Exit" value={`$${data.exitPrice.toFixed(2)}`} />
                <StatBox
                  label="Return"
                  value={`${isProfit ? '+' : ''}${data.pnlPercent.toFixed(1)}%`}
                  highlight={isProfit}
                />
              </>
            )}
          </div>
        </div>

        {/* User Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-neutral-900/30 border-t border-neutral-800/50">
          <div className="flex items-center gap-2">
            {data.avatarUrl ? (
              <img
                src={data.avatarUrl}
                alt={data.username}
                className="w-7 h-7 rounded-none border border-neutral-700"
              />
            ) : (
              <div className="w-7 h-7 bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-400 border border-neutral-700">
                {data.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium text-neutral-300">{data.username}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <span>
              {(data.timestamp || new Date()).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="text-neutral-700">|</span>
            <span className="text-amber-500/70">kaycapitals.com</span>
          </div>
        </div>

        {/* Bottom Gradient Bar */}
        <div className={cn('h-1 w-full bg-gradient-to-r', style.accent)} />
      </motion.div>

      {/* Action Buttons */}
      {showActions && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 no-export"
        >
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            loading={downloading}
            onClick={handleExport}
            disabled={!fontsLoaded}
          >
            {downloading ? 'Exporting...' : 'Download PNG'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Twitter className="w-4 h-4" />}
            onClick={handleShareTwitter}
          >
            Tweet
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            onClick={handleCopyLink}
          >
            {copied ? 'Copied!' : 'Share Link'}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 px-3 py-2 text-center">
      <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div
        className={cn(
          'text-sm font-bold',
          highlight ? 'text-amber-400' : 'text-white'
        )}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {value}
      </div>
    </div>
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate mock price history for sparkline when real data isn't available
 */
function generateMockPriceHistory(
  entryPrice: number,
  exitPrice: number,
  points: number = 20
): number[] {
  const history: number[] = [entryPrice];
  const diff = exitPrice - entryPrice;
  const isUp = diff > 0;

  for (let i = 1; i < points - 1; i++) {
    const progress = i / (points - 1);
    // Add some randomness but trend toward exit price
    const basePrice = entryPrice + diff * progress;
    const noise = (Math.random() - 0.5) * Math.abs(diff) * 0.3;
    // Bias noise based on direction
    const directionBias = isUp ? Math.random() * 0.1 : -Math.random() * 0.1;
    history.push(basePrice + noise + directionBias * Math.abs(diff));
  }

  history.push(exitPrice);
  return history;
}

/**
 * Standalone export function for use outside the component
 */
export async function exportWinCardToPng(
  element: HTMLElement,
  filename?: string
): Promise<string> {
  // Wait for fonts
  if (document.fonts) {
    await document.fonts.ready;
  }

  const dataUrl = await toPng(element, {
    quality: 1,
    pixelRatio: 3,
    backgroundColor: '#0a0a0a',
  });

  if (filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  return dataUrl;
}

export default FlexWinCard;
