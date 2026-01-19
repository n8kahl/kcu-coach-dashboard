'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LivePriceProps {
  price: number;
  previousPrice?: number;
  symbol?: string;
  showChange?: boolean;
  showPercentChange?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

type PriceDirection = 'up' | 'down' | 'neutral';

/**
 * LivePrice Component
 *
 * A Bloomberg Terminal-style price display that animates on price changes.
 * - Flashes green with ▲ when price increases
 * - Flashes red with ▼ when price decreases
 * - Uses JetBrains Mono with tabular-nums for stable digit width
 */
export function LivePrice({
  price,
  previousPrice,
  symbol,
  showChange = false,
  showPercentChange = false,
  size = 'md',
  className,
}: LivePriceProps) {
  const [direction, setDirection] = useState<PriceDirection>('neutral');
  const [isFlashing, setIsFlashing] = useState(false);
  const prevPriceRef = useRef<number>(price);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine price direction and trigger flash
  useEffect(() => {
    const prev = previousPrice ?? prevPriceRef.current;

    if (price > prev) {
      setDirection('up');
      setIsFlashing(true);
    } else if (price < prev) {
      setDirection('down');
      setIsFlashing(true);
    }

    // Store current price for next comparison
    prevPriceRef.current = price;

    // Clear existing timeout
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }

    // Reset flash after animation
    flashTimeoutRef.current = setTimeout(() => {
      setIsFlashing(false);
    }, 500);

    return () => {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, [price, previousPrice]);

  // Calculate change values
  const prev = previousPrice ?? prevPriceRef.current;
  const change = price - prev;
  const percentChange = prev !== 0 ? ((price - prev) / prev) * 100 : 0;

  // Size variants
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  };

  const arrowSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  // Direction colors
  const getDirectionColor = () => {
    if (!isFlashing) return 'text-white';
    switch (direction) {
      case 'up':
        return 'text-emerald-400';
      case 'down':
        return 'text-red-400';
      default:
        return 'text-white';
    }
  };

  const getBackgroundFlash = () => {
    if (!isFlashing) return 'bg-transparent';
    switch (direction) {
      case 'up':
        return 'bg-emerald-500/20';
      case 'down':
        return 'bg-red-500/20';
      default:
        return 'bg-transparent';
    }
  };

  const getArrow = () => {
    switch (direction) {
      case 'up':
        return '▲';
      case 'down':
        return '▼';
      default:
        return null;
    }
  };

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      {/* Symbol (optional) */}
      {symbol && (
        <span className={cn(
          'font-semibold text-neutral-400',
          sizeClasses[size]
        )}>
          {symbol}
        </span>
      )}

      {/* Price with flash animation */}
      <motion.div
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none transition-colors duration-500',
          'font-mono tabular-nums',
          sizeClasses[size],
          getDirectionColor(),
          getBackgroundFlash()
        )}
        animate={{
          scale: isFlashing ? [1, 1.02, 1] : 1,
        }}
        transition={{ duration: 0.15 }}
      >
        {/* Direction arrow */}
        <AnimatePresence mode="wait">
          {isFlashing && direction !== 'neutral' && (
            <motion.span
              key={direction}
              initial={{ opacity: 0, y: direction === 'up' ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                arrowSizes[size],
                direction === 'up' ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {getArrow()}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Price value */}
        <span className="font-medium">
          ${price.toFixed(2)}
        </span>
      </motion.div>

      {/* Change amount (optional) */}
      {showChange && (
        <span className={cn(
          'font-mono tabular-nums',
          sizeClasses[size],
          change >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}
        </span>
      )}

      {/* Percent change (optional) */}
      {showPercentChange && (
        <span className={cn(
          'font-mono tabular-nums',
          sizeClasses[size],
          percentChange >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          ({percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}

/**
 * LivePriceCompact - A more compact version for tight spaces
 */
interface LivePriceCompactProps {
  price: number;
  previousPrice?: number;
  className?: string;
}

export function LivePriceCompact({ price, previousPrice, className }: LivePriceCompactProps) {
  const [isUp, setIsUp] = useState<boolean | null>(null);
  const prevRef = useRef(price);

  useEffect(() => {
    const prev = previousPrice ?? prevRef.current;
    if (price > prev) setIsUp(true);
    else if (price < prev) setIsUp(false);
    else setIsUp(null);
    prevRef.current = price;
  }, [price, previousPrice]);

  return (
    <span
      className={cn(
        'font-mono tabular-nums text-sm transition-colors duration-500',
        isUp === true && 'text-emerald-400',
        isUp === false && 'text-red-400',
        isUp === null && 'text-white',
        className
      )}
    >
      ${price.toFixed(2)}
    </span>
  );
}

/**
 * LivePriceWithSparkline - Price with mini trend indicator
 */
interface LivePriceWithSparklineProps {
  price: number;
  previousPrice?: number;
  history?: number[];
  className?: string;
}

export function LivePriceWithSparkline({
  price,
  previousPrice,
  history = [],
  className,
}: LivePriceWithSparklineProps) {
  const [direction, setDirection] = useState<PriceDirection>('neutral');
  const prevRef = useRef(price);

  useEffect(() => {
    const prev = previousPrice ?? prevRef.current;
    if (price > prev) setDirection('up');
    else if (price < prev) setDirection('down');
    else setDirection('neutral');
    prevRef.current = price;
  }, [price, previousPrice]);

  // Generate sparkline path
  const generateSparkline = () => {
    if (history.length < 2) return '';

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const width = 40;
    const height = 16;

    const points = history.map((val, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  };

  const sparklineColor = direction === 'up'
    ? '#22c55e'
    : direction === 'down'
      ? '#ef4444'
      : '#737373';

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {/* Mini sparkline */}
      {history.length > 1 && (
        <svg width="40" height="16" className="overflow-visible">
          <path
            d={generateSparkline()}
            fill="none"
            stroke={sparklineColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* Price */}
      <LivePrice price={price} previousPrice={previousPrice} size="sm" />
    </div>
  );
}

export default LivePrice;
