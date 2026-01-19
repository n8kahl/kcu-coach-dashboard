'use client';

/**
 * useCandleReplay Hook
 *
 * Creates realistic candle "painting" animation for practice mode.
 * Instead of candles appearing instantly, they animate over a duration
 * showing the OHLC progression as if watching real-time price action.
 *
 * Animation Sequence:
 * 1. Open price appears (candle starts as a line)
 * 2. Price ticks toward first extreme (High or Low)
 * 3. Price ticks toward second extreme
 * 4. Price settles at Close
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface OHLCCandle {
  t: number;  // timestamp in milliseconds
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}

export interface AnimatingCandle extends OHLCCandle {
  // Current animated values (change during animation)
  currentHigh: number;
  currentLow: number;
  currentClose: number;
  // Animation progress (0-1)
  progress: number;
  // Is this candle currently animating?
  isAnimating: boolean;
}

export interface CandleReplayState {
  /** The candle being animated (null when not animating) */
  animatingCandle: AnimatingCandle | null;
  /** Whether an animation is in progress */
  isAnimating: boolean;
  /** Progress of current animation (0-1) */
  progress: number;
}

export interface UseCandleReplayOptions {
  /** Duration of the candle painting animation in ms (default: 500) */
  duration?: number;
  /** Easing function (default: easeOutCubic for natural feel) */
  easing?: (t: number) => number;
  /** Called when animation completes */
  onComplete?: (candle: OHLCCandle) => void;
  /** Called on each animation frame with intermediate candle */
  onFrame?: (candle: AnimatingCandle) => void;
  /** Enable realistic price path (adds micro-fluctuations) */
  realisticPath?: boolean;
}

export interface UseCandleReplayReturn {
  /** Current state of the replay */
  state: CandleReplayState;
  /** Start animating a new candle */
  animateCandle: (candle: OHLCCandle) => void;
  /** Cancel current animation */
  cancelAnimation: () => void;
  /** Get intermediate candle for current frame */
  getIntermediateCandle: () => AnimatingCandle | null;
  /** Is currently animating */
  isAnimating: boolean;
}

// =============================================================================
// Easing Functions
// =============================================================================

/**
 * Easing functions for natural-feeling animations
 */
export const easingFunctions = {
  // Smooth deceleration - good for price settling
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),

  // Accelerate then decelerate - good for dramatic moves
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  // Quick start, slow end - good for market momentum
  easeOutQuart: (t: number): number => 1 - Math.pow(1 - t, 4),

  // Linear - for testing
  linear: (t: number): number => t,

  // Bounce effect at end
  easeOutBounce: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// =============================================================================
// Animation Path Generator
// =============================================================================

/**
 * Determines the animation path for a candle based on its characteristics
 *
 * For bullish candles (close > open):
 *   Open → dip to Low → rally to High → settle at Close
 *
 * For bearish candles (close < open):
 *   Open → spike to High → drop to Low → settle at Close
 *
 * This mimics realistic intraday price action.
 */
interface PricePath {
  phase1End: number;    // Progress at which phase 1 ends (0-1)
  phase2End: number;    // Progress at which phase 2 ends (0-1)
  // Phase 1: Open → First extreme
  // Phase 2: First extreme → Second extreme
  // Phase 3: Second extreme → Close
}

function calculatePricePath(candle: OHLCCandle): PricePath {
  const isBullish = candle.c >= candle.o;
  const range = candle.h - candle.l;
  const bodySize = Math.abs(candle.c - candle.o);

  // Adjust phases based on candle characteristics
  // Candles with long wicks spend more time at extremes
  const wickRatio = range > 0 ? bodySize / range : 0.5;

  if (isBullish) {
    // Bullish: dip first, then rally
    // More time rallying if strong bullish candle
    return {
      phase1End: 0.25 + (1 - wickRatio) * 0.1,  // 25-35% for dip
      phase2End: 0.75 - (1 - wickRatio) * 0.1,  // 65-75% for rally
    };
  } else {
    // Bearish: spike first, then drop
    // More time dropping if strong bearish candle
    return {
      phase1End: 0.25 + (1 - wickRatio) * 0.1,  // 25-35% for spike
      phase2End: 0.75 - (1 - wickRatio) * 0.1,  // 65-75% for drop
    };
  }
}

/**
 * Interpolate price at a given progress point along the animation path
 */
function interpolatePrice(
  candle: OHLCCandle,
  progress: number,
  path: PricePath,
  easing: (t: number) => number
): { currentHigh: number; currentLow: number; currentClose: number } {
  const isBullish = candle.c >= candle.o;

  // Apply easing to progress
  const easedProgress = easing(progress);

  if (easedProgress <= path.phase1End) {
    // Phase 1: Open → First extreme
    const phaseProgress = easedProgress / path.phase1End;
    const easedPhaseProgress = easing(phaseProgress);

    if (isBullish) {
      // Dip toward low first
      const currentLow = candle.o - (candle.o - candle.l) * easedPhaseProgress;
      return {
        currentHigh: candle.o, // High hasn't been touched yet
        currentLow,
        currentClose: currentLow, // Price is at the low
      };
    } else {
      // Spike toward high first
      const currentHigh = candle.o + (candle.h - candle.o) * easedPhaseProgress;
      return {
        currentHigh,
        currentLow: candle.o, // Low hasn't been touched yet
        currentClose: currentHigh, // Price is at the high
      };
    }
  } else if (easedProgress <= path.phase2End) {
    // Phase 2: First extreme → Second extreme
    const phaseProgress = (easedProgress - path.phase1End) / (path.phase2End - path.phase1End);
    const easedPhaseProgress = easing(phaseProgress);

    if (isBullish) {
      // Rally from low to high
      const currentClose = candle.l + (candle.h - candle.l) * easedPhaseProgress;
      return {
        currentHigh: Math.max(candle.o, currentClose),
        currentLow: candle.l, // Low is established
        currentClose,
      };
    } else {
      // Drop from high to low
      const currentClose = candle.h - (candle.h - candle.l) * easedPhaseProgress;
      return {
        currentHigh: candle.h, // High is established
        currentLow: Math.min(candle.o, currentClose),
        currentClose,
      };
    }
  } else {
    // Phase 3: Second extreme → Close
    const phaseProgress = (easedProgress - path.phase2End) / (1 - path.phase2End);
    const easedPhaseProgress = easing(phaseProgress);

    if (isBullish) {
      // Settle from high to close
      const currentClose = candle.h - (candle.h - candle.c) * easedPhaseProgress;
      return {
        currentHigh: candle.h, // Final high
        currentLow: candle.l, // Final low
        currentClose,
      };
    } else {
      // Settle from low to close
      const currentClose = candle.l + (candle.c - candle.l) * easedPhaseProgress;
      return {
        currentHigh: candle.h, // Final high
        currentLow: candle.l, // Final low
        currentClose,
      };
    }
  }
}

/**
 * Add micro-fluctuations for more realistic price action
 */
function addMicroFluctuations(
  price: number,
  range: number,
  progress: number
): number {
  // Fluctuations decrease as we approach the end (price settling)
  const fluctuationStrength = (1 - progress) * 0.02;
  const noise = (Math.sin(progress * 50) + Math.sin(progress * 123)) * 0.5;
  return price + noise * range * fluctuationStrength;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useCandleReplay(
  options: UseCandleReplayOptions = {}
): UseCandleReplayReturn {
  const {
    duration = 500,
    easing = easingFunctions.easeOutCubic,
    onComplete,
    onFrame,
    realisticPath = true,
  } = options;

  // State
  const [state, setState] = useState<CandleReplayState>({
    animatingCandle: null,
    isAnimating: false,
    progress: 0,
  });

  // Refs for animation
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const targetCandleRef = useRef<OHLCCandle | null>(null);
  const pathRef = useRef<PricePath | null>(null);

  /**
   * Cancel any running animation
   */
  const cancelAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    startTimeRef.current = null;
    targetCandleRef.current = null;
    pathRef.current = null;

    setState({
      animatingCandle: null,
      isAnimating: false,
      progress: 0,
    });
  }, []);

  /**
   * Animation loop using requestAnimationFrame
   */
  const animate = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      const candle = targetCandleRef.current;
      const path = pathRef.current;

      if (!candle || !path) {
        cancelAnimation();
        return;
      }

      // Calculate intermediate values
      const intermediate = interpolatePrice(candle, progress, path, easing);

      // Add micro-fluctuations for realism
      let { currentHigh, currentLow, currentClose } = intermediate;
      if (realisticPath && progress < 0.95) {
        const range = candle.h - candle.l;
        currentClose = addMicroFluctuations(currentClose, range, progress);
        // Keep close within bounds
        currentClose = Math.max(currentLow, Math.min(currentHigh, currentClose));
      }

      const animatingCandle: AnimatingCandle = {
        ...candle,
        currentHigh,
        currentLow,
        currentClose,
        progress,
        isAnimating: progress < 1,
      };

      // Update state
      setState({
        animatingCandle,
        isAnimating: progress < 1,
        progress,
      });

      // Callback for each frame
      onFrame?.(animatingCandle);

      if (progress < 1) {
        // Continue animation
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete - finalize with exact values
        const finalCandle: AnimatingCandle = {
          ...candle,
          currentHigh: candle.h,
          currentLow: candle.l,
          currentClose: candle.c,
          progress: 1,
          isAnimating: false,
        };

        setState({
          animatingCandle: finalCandle,
          isAnimating: false,
          progress: 1,
        });

        onComplete?.(candle);

        // Clean up refs
        animationFrameRef.current = null;
        startTimeRef.current = null;
      }
    },
    [duration, easing, realisticPath, onComplete, onFrame, cancelAnimation]
  );

  /**
   * Start animating a new candle
   */
  const animateCandle = useCallback(
    (candle: OHLCCandle) => {
      // Cancel any existing animation
      cancelAnimation();

      // Store target candle and calculate path
      targetCandleRef.current = candle;
      pathRef.current = calculatePricePath(candle);

      // Start with open price only
      const initialCandle: AnimatingCandle = {
        ...candle,
        currentHigh: candle.o,
        currentLow: candle.o,
        currentClose: candle.o,
        progress: 0,
        isAnimating: true,
      };

      setState({
        animatingCandle: initialCandle,
        isAnimating: true,
        progress: 0,
      });

      // Start animation loop
      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [animate, cancelAnimation]
  );

  /**
   * Get the current intermediate candle (for rendering)
   */
  const getIntermediateCandle = useCallback((): AnimatingCandle | null => {
    return state.animatingCandle;
  }, [state.animatingCandle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    state,
    animateCandle,
    cancelAnimation,
    getIntermediateCandle,
    isAnimating: state.isAnimating,
  };
}

// =============================================================================
// Utility: Batch Candle Replay
// =============================================================================

/**
 * Hook for replaying multiple candles in sequence (for auto-play mode)
 */
export interface UseBatchCandleReplayOptions extends UseCandleReplayOptions {
  /** Candles to replay */
  candles: OHLCCandle[];
  /** Starting index */
  startIndex?: number;
  /** Auto-play on mount */
  autoPlay?: boolean;
  /** Delay between candles in ms */
  candleDelay?: number;
}

export function useBatchCandleReplay(options: UseBatchCandleReplayOptions) {
  const {
    candles,
    startIndex = 0,
    autoPlay = false,
    candleDelay = 100,
    ...replayOptions
  } = options;

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleComplete = useCallback(
    (candle: OHLCCandle) => {
      // Call original onComplete if provided
      replayOptions.onComplete?.(candle);

      // Move to next candle if playing
      if (isPlaying && currentIndex < candles.length - 1) {
        delayTimeoutRef.current = setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
        }, candleDelay);
      } else if (currentIndex >= candles.length - 1) {
        setIsPlaying(false);
      }
    },
    [isPlaying, currentIndex, candles.length, candleDelay, replayOptions]
  );

  const replay = useCandleReplay({
    ...replayOptions,
    onComplete: handleComplete,
  });

  // Start animation when index changes during playback
  useEffect(() => {
    if (isPlaying && candles[currentIndex]) {
      replay.animateCandle(candles[currentIndex]);
    }
  }, [currentIndex, isPlaying, candles, replay]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
    };
  }, []);

  const play = useCallback(() => {
    setIsPlaying(true);
    if (candles[currentIndex]) {
      replay.animateCandle(candles[currentIndex]);
    }
  }, [candles, currentIndex, replay]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    replay.cancelAnimation();
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
    }
  }, [replay]);

  const reset = useCallback(() => {
    pause();
    setCurrentIndex(startIndex);
  }, [pause, startIndex]);

  const stepForward = useCallback(() => {
    if (currentIndex < candles.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      replay.animateCandle(candles[nextIndex]);
    }
  }, [currentIndex, candles, replay]);

  return {
    ...replay,
    currentIndex,
    isPlaying,
    play,
    pause,
    reset,
    stepForward,
    totalCandles: candles.length,
  };
}

export default useCandleReplay;
