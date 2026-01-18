'use client';

import { forwardRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

/* =============================================================================
 * GLOW EFFECT COMPONENT
 * Premium glow effect wrapper for any component
 * ============================================================================= */

interface GlowProps {
  children: React.ReactNode;
  className?: string;
  /** Glow color variant */
  color?: 'gold' | 'profit' | 'loss' | 'info' | 'custom';
  /** Custom glow color (when color="custom") */
  customColor?: string;
  /** Glow intensity (0-1) */
  intensity?: number;
  /** Enable pulse animation */
  pulse?: boolean;
  /** Enable glow on hover only */
  hoverOnly?: boolean;
  /** Disable glow animations */
  disableAnimation?: boolean;
}

const glowColors = {
  gold: 'rgba(212, 175, 55, VAR)',
  profit: 'rgba(16, 185, 129, VAR)',
  loss: 'rgba(239, 68, 68, VAR)',
  info: 'rgba(59, 130, 246, VAR)',
  custom: 'rgba(212, 175, 55, VAR)',
};

export function Glow({
  children,
  className,
  color = 'gold',
  customColor,
  intensity = 0.5,
  pulse = false,
  hoverOnly = false,
  disableAnimation = false,
}: GlowProps) {
  const [isHovered, setIsHovered] = useState(false);
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

  const shouldAnimate = !disableAnimation && !prefersReducedMotion;
  const showGlow = hoverOnly ? isHovered : true;

  const glowColor = customColor || glowColors[color].replace('VAR', String(intensity));
  const glowColorStrong = customColor || glowColors[color].replace('VAR', String(Math.min(intensity + 0.2, 1)));

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showGlow && (
        <motion.div
          className="absolute inset-0 -z-10 pointer-events-none"
          initial={shouldAnimate ? { opacity: 0 } : undefined}
          animate={
            shouldAnimate
              ? {
                  opacity: 1,
                  boxShadow: pulse
                    ? [
                        `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
                        `0 0 30px ${glowColorStrong}, 0 0 60px ${glowColorStrong}`,
                        `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
                      ]
                    : `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
                }
              : undefined
          }
          transition={
            pulse
              ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.3 }
          }
          style={{ borderRadius: 'inherit' }}
        />
      )}
      {children}
    </div>
  );
}

/* =============================================================================
 * SPOTLIGHT EFFECT
 * Creates a spotlight/highlight that follows mouse
 * ============================================================================= */

interface SpotlightProps {
  children: React.ReactNode;
  className?: string;
  /** Size of the spotlight in pixels */
  size?: number;
  /** Spotlight color */
  color?: string;
  /** Spotlight opacity (0-1) */
  opacity?: number;
}

export function Spotlight({
  children,
  className,
  size = 200,
  color = 'rgba(212, 175, 55, 0.15)',
  opacity = 1,
}: SpotlightProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left - size / 2);
      mouseY.set(e.clientY - rect.top - size / 2);
    },
    [mouseX, mouseY, size, prefersReducedMotion]
  );

  const smoothX = useSpring(mouseX, { stiffness: 300, damping: 30 });
  const smoothY = useSpring(mouseY, { stiffness: 300, damping: 30 });

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onMouseMove={handleMouseMove}
    >
      {!prefersReducedMotion && (
        <motion.div
          className="pointer-events-none absolute z-0"
          style={{
            x: smoothX,
            y: smoothY,
            width: size,
            height: size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
            opacity,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* =============================================================================
 * SHINE EFFECT
 * Creates a sweeping shine/shimmer effect
 * ============================================================================= */

interface ShineProps {
  children: React.ReactNode;
  className?: string;
  /** Shine angle in degrees */
  angle?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Animation delay in seconds */
  delay?: number;
  /** Shine color */
  color?: string;
}

export function Shine({
  children,
  className,
  angle = 45,
  duration = 2,
  delay = 0,
  color = 'rgba(255, 255, 255, 0.2)',
}: ShineProps) {
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
    <div className={cn('relative overflow-hidden', className)}>
      {children}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(${angle}deg, transparent 0%, ${color} 50%, transparent 100%)`,
            backgroundSize: '200% 100%',
          }}
          animate={{
            backgroundPosition: ['-200% center', '200% center'],
          }}
          transition={{
            duration,
            delay,
            repeat: Infinity,
            repeatDelay: 3,
            ease: 'easeInOut',
          }}
        />
      )}
    </div>
  );
}

/* =============================================================================
 * GRADIENT BORDER
 * Creates animated gradient border effect
 * ============================================================================= */

interface GradientBorderProps {
  children: React.ReactNode;
  className?: string;
  /** Border width in pixels */
  borderWidth?: number;
  /** Gradient colors */
  colors?: string[];
  /** Enable rotation animation */
  animate?: boolean;
  /** Animation duration in seconds */
  duration?: number;
}

export function GradientBorder({
  children,
  className,
  borderWidth = 2,
  colors = ['#d4af37', '#f5d742', '#d4af37'],
  animate = true,
  duration = 4,
}: GradientBorderProps) {
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

  const shouldAnimate = animate && !prefersReducedMotion;

  return (
    <div className={cn('relative', className)}>
      {/* Gradient border */}
      <motion.div
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(90deg, ${colors.join(', ')})`,
          backgroundSize: '200% 200%',
          borderRadius: 'inherit',
          padding: borderWidth,
        }}
        animate={
          shouldAnimate
            ? {
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }
            : undefined
        }
        transition={
          shouldAnimate
            ? {
                duration,
                repeat: Infinity,
                ease: 'linear',
              }
            : undefined
        }
      />
      {/* Inner content */}
      <div
        className="relative bg-[var(--bg-card)]"
        style={{
          margin: borderWidth,
          borderRadius: 'inherit',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* =============================================================================
 * CONFETTI EFFECT
 * Burst of confetti particles
 * ============================================================================= */

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
}

interface ConfettiProps {
  /** Trigger confetti burst */
  active: boolean;
  /** Number of particles */
  count?: number;
  /** Particle colors */
  colors?: string[];
  /** Duration in seconds */
  duration?: number;
  className?: string;
}

export function Confetti({
  active,
  count = 50,
  colors = ['#d4af37', '#f5d742', '#10b981', '#3b82f6', '#ec4899'],
  duration = 2,
  className,
}: ConfettiProps) {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);

  useEffect(() => {
    if (active) {
      const newParticles: ConfettiParticle[] = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        rotation: Math.random() * 360,
        scale: 0.5 + Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => setParticles([]), duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [active, count, colors, duration]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className={cn('absolute inset-0 pointer-events-none overflow-hidden', className)}>
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                backgroundColor: particle.color,
                transform: `rotate(${particle.rotation}deg) scale(${particle.scale})`,
              }}
              initial={{ y: 0, opacity: 1 }}
              animate={{
                y: [0, -100, 200],
                x: [0, (Math.random() - 0.5) * 200],
                rotate: particle.rotation + 360 * 2,
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

/* =============================================================================
 * PULSE INDICATOR
 * Live/active indicator with pulsing animation
 * ============================================================================= */

interface PulseIndicatorProps {
  /** Indicator size */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  color?: 'green' | 'red' | 'gold' | 'blue';
  /** Show pulsing animation */
  animate?: boolean;
  className?: string;
}

const pulseColors = {
  green: 'bg-[var(--success)]',
  red: 'bg-[var(--error)]',
  gold: 'bg-[var(--accent-primary)]',
  blue: 'bg-[var(--info)]',
};

const pulseSizes = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function PulseIndicator({
  size = 'sm',
  color = 'green',
  animate = true,
  className,
}: PulseIndicatorProps) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <span
        className={cn(
          'rounded-full',
          pulseSizes[size],
          pulseColors[color]
        )}
      />
      {animate && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            pulseColors[color]
          )}
        />
      )}
    </span>
  );
}

/* =============================================================================
 * ANIMATED COUNTER
 * Smooth number counting animation
 * ============================================================================= */

interface AnimatedCounterProps {
  value: number;
  /** Format function */
  format?: (value: number) => string;
  /** Animation duration in seconds */
  duration?: number;
  /** Decimal places */
  decimals?: number;
  /** Prefix (e.g., "$") */
  prefix?: string;
  /** Suffix (e.g., "%") */
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({
  value,
  format,
  duration = 1,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: AnimatedCounterProps) {
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
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + diff * eased);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value, duration, prefersReducedMotion]);

  const formattedValue = format
    ? format(displayValue)
    : `${prefix}${displayValue.toFixed(decimals)}${suffix}`;

  return <span className={className}>{formattedValue}</span>;
}

/* =============================================================================
 * VALUE CHANGE INDICATOR
 * Shows positive/negative change with color and animation
 * ============================================================================= */

interface ValueChangeProps {
  value: number;
  /** Previous value for comparison */
  previousValue?: number;
  /** Format function */
  format?: (value: number) => string;
  /** Show arrow indicator */
  showArrow?: boolean;
  /** Show percentage */
  showPercent?: boolean;
  className?: string;
}

export function ValueChange({
  value,
  previousValue = 0,
  format,
  showArrow = true,
  showPercent = false,
  className,
}: ValueChangeProps) {
  const change = value - previousValue;
  const percentChange = previousValue !== 0 ? ((change / previousValue) * 100) : 0;
  const isPositive = change >= 0;

  const formattedChange = format
    ? format(Math.abs(change))
    : Math.abs(change).toFixed(2);

  return (
    <motion.span
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        isPositive ? 'text-[var(--profit)]' : 'text-[var(--loss)]',
        className
      )}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {showArrow && (
        <span className={cn(isPositive ? 'rotate-0' : 'rotate-180')}>▲</span>
      )}
      {isPositive ? '+' : '-'}{formattedChange}
      {showPercent && ` (${Math.abs(percentChange).toFixed(1)}%)`}
    </motion.span>
  );
}
