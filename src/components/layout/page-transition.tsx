'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';

/**
 * Premium page transition animations for the KCU Coach Dashboard.
 * Provides smooth, professional transitions between pages with support for
 * reduced motion preferences.
 */

// Animation variants for page transitions
const pageVariants = {
  initial: {
    opacity: 0,
    y: 16,
    scale: 0.99,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.99,
  },
};

// Reduced motion variants (respects prefers-reduced-motion)
const reducedMotionVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Premium timing with custom bezier curves
const pageTransition = {
  type: 'tween',
  ease: [0.16, 1, 0.3, 1], // Premium ease-out-expo
  duration: 0.4,
};

const reducedMotionTransition = {
  type: 'tween',
  duration: 0.15,
};

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  /** Custom transition duration in seconds */
  duration?: number;
  /** Disable animations (useful for testing) */
  disabled?: boolean;
}

/**
 * PageTransition wraps page content to provide smooth entrance/exit animations.
 * Automatically respects the user's prefers-reduced-motion setting.
 */
export function PageTransition({
  children,
  className = '',
  duration,
  disabled = false,
}: PageTransitionProps) {
  const pathname = usePathname();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const shouldAnimate = !disabled && !prefersReducedMotion;
  const variants = shouldAnimate ? pageVariants : reducedMotionVariants;
  const transition = {
    ...(shouldAnimate ? pageTransition : reducedMotionTransition),
    ...(duration ? { duration } : {}),
  };

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={transition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * FadeIn component for staggered entrance animations.
 * Use this to animate individual elements within a page.
 */
interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  /** Delay before animation starts (in seconds) */
  delay?: number;
  /** Animation duration (in seconds) */
  duration?: number;
  /** Direction to animate from */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  /** Distance to travel (in pixels) */
  distance?: number;
}

const directionOffsets = {
  up: { y: 16, x: 0 },
  down: { y: -16, x: 0 },
  left: { x: 16, y: 0 },
  right: { x: -16, y: 0 },
  none: { x: 0, y: 0 },
};

export function FadeIn({
  children,
  className = '',
  delay = 0,
  duration = 0.4,
  direction = 'up',
  distance,
}: FadeInProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const offset = directionOffsets[direction];
  const actualDistance = distance ?? (direction === 'none' ? 0 : 16);
  const scale = actualDistance / 16;

  const variants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }
    : {
        hidden: {
          opacity: 0,
          x: offset.x * scale,
          y: offset.y * scale,
        },
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
        },
      };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={{
        duration: prefersReducedMotion ? 0.15 : duration,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerChildren wraps a list of items to animate them one by one.
 */
interface StaggerChildrenProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between each child animation (in seconds) */
  staggerDelay?: number;
  /** Initial delay before first child animates (in seconds) */
  initialDelay?: number;
}

export function StaggerChildren({
  children,
  className = '',
  staggerDelay = 0.1,
  initialDelay = 0,
}: StaggerChildrenProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: prefersReducedMotion ? 0 : staggerDelay,
            delayChildren: prefersReducedMotion ? 0 : initialDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem should be used as a child of StaggerChildren.
 */
interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerItem({ children, className = '' }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1],
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScaleIn component for pop-in animations (great for modals, tooltips, achievements).
 */
interface ScaleInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  /** Use bouncy spring animation */
  spring?: boolean;
}

export function ScaleIn({
  children,
  className = '',
  delay = 0,
  duration = 0.3,
  spring = false,
}: ScaleInProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={
        spring && !prefersReducedMotion
          ? {
              type: 'spring',
              stiffness: 400,
              damping: 25,
              delay,
            }
          : {
              duration: prefersReducedMotion ? 0.15 : duration,
              delay: prefersReducedMotion ? 0 : delay,
              ease: spring ? [0.34, 1.56, 0.64, 1] : [0.16, 1, 0.3, 1],
            }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * SlidePanel for sliding drawer/panel animations.
 */
interface SlidePanelProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  onClose?: () => void;
}

const slideDirections = {
  left: { x: '-100%', y: 0 },
  right: { x: '100%', y: 0 },
  top: { x: 0, y: '-100%' },
  bottom: { x: 0, y: '100%' },
};

export function SlidePanel({
  children,
  className = '',
  isOpen,
  direction = 'right',
  onClose,
}: SlidePanelProps) {
  const offset = slideDirections[direction];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Panel */}
          <motion.div
            initial={{ ...offset, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={{ ...offset, opacity: 0 }}
            transition={{
              type: 'tween',
              duration: 0.3,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={`fixed z-50 ${className}`}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * AnimatedNumber for smooth number transitions (great for stats/P&L).
 */
interface AnimatedNumberProps {
  value: number;
  className?: string;
  /** Format function for the number display */
  format?: (value: number) => string;
  /** Animation duration in seconds */
  duration?: number;
}

export function AnimatedNumber({
  value,
  className = '',
  format = (v) => v.toFixed(0),
  duration = 0.5,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    const startValue = displayValue;
    const diff = value - startValue;
    const startTime = performance.now();
    const endTime = startTime + duration * 1000;

    const animate = (currentTime: number) => {
      if (currentTime >= endTime) {
        setDisplayValue(value);
        return;
      }

      const progress = (currentTime - startTime) / (duration * 1000);
      // Ease out expo
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + diff * eased);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value, duration, prefersReducedMotion]);

  return <span className={className}>{format(displayValue)}</span>;
}

/**
 * PulseOnChange component that pulses when its children change.
 * Great for highlighting updated values.
 */
interface PulseOnChangeProps {
  children: React.ReactNode;
  className?: string;
  /** Unique key that triggers pulse when changed */
  triggerKey: string | number;
  /** Color of the pulse */
  color?: 'gold' | 'profit' | 'loss' | 'default';
}

const pulseColors = {
  gold: 'rgba(212, 175, 55, 0.4)',
  profit: 'rgba(16, 185, 129, 0.4)',
  loss: 'rgba(239, 68, 68, 0.4)',
  default: 'rgba(59, 130, 246, 0.4)',
};

export function PulseOnChange({
  children,
  className = '',
  triggerKey,
  color = 'default',
}: PulseOnChangeProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevKey, setPrevKey] = useState(triggerKey);

  useEffect(() => {
    if (triggerKey !== prevKey) {
      setIsAnimating(true);
      setPrevKey(triggerKey);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [triggerKey, prevKey]);

  return (
    <motion.div
      animate={
        isAnimating
          ? {
              boxShadow: [
                `0 0 0 0 ${pulseColors[color]}`,
                `0 0 0 8px transparent`,
              ],
            }
          : {}
      }
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
