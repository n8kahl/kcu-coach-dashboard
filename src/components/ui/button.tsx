'use client';

import { forwardRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { motion, type HTMLMotionProps, AnimatePresence } from 'framer-motion';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  /** Enable ripple effect on click */
  ripple?: boolean;
  /** Disable all animations */
  disableAnimation?: boolean;
}

// Ripple effect component
interface RippleEffect {
  id: number;
  x: number;
  y: number;
  size: number;
}

const Ripple = ({ x, y, size, onComplete }: RippleEffect & { onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.span
      initial={{ scale: 0, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="absolute rounded-full bg-current pointer-events-none"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        opacity: 0.2,
      }}
    />
  );
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      ripple = true,
      disableAnimation = false,
      children,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState<RippleEffect[]>([]);
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

    const shouldAnimate = !disableAnimation && !prefersReducedMotion;

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (ripple && shouldAnimate && !disabled && !loading) {
          const button = e.currentTarget;
          const rect = button.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const size = Math.max(rect.width, rect.height) * 2;

          setRipples((prev) => [...prev, { id: Date.now(), x, y, size }]);
        }
        onClick?.(e);
      },
      [ripple, shouldAnimate, disabled, loading, onClick]
    );

    const removeRipple = useCallback((id: number) => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, []);

    const variants = {
      primary: cn(
        'bg-[var(--accent-primary)] text-[var(--bg-primary)] border-[var(--accent-primary)]',
        'hover:bg-[var(--accent-primary-hover)] hover:border-[var(--accent-primary-hover)]',
        'hover:shadow-glow-sm active:shadow-glow-md',
        'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
      ),
      secondary: cn(
        'bg-transparent text-[var(--text-primary)] border-[var(--border-secondary)]',
        'hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
      ),
      ghost: cn(
        'bg-transparent text-[var(--text-secondary)] border-transparent',
        'hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--border-secondary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
      ),
      danger: cn(
        'bg-[var(--error)] text-white border-[var(--error)]',
        'hover:bg-[var(--error-muted)] hover:shadow-loss',
        'focus-visible:ring-2 focus-visible:ring-[var(--error)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
      ),
      success: cn(
        'bg-[var(--success)] text-white border-[var(--success)]',
        'hover:bg-[var(--success-muted)] hover:shadow-profit',
        'focus-visible:ring-2 focus-visible:ring-[var(--success)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
      ),
      gold: cn(
        'bg-gradient-to-r from-[var(--accent-primary)] to-[#f5d742] text-[var(--bg-primary)] border-[var(--accent-primary)]',
        'hover:shadow-glow-lg hover:from-[var(--accent-primary-hover)] hover:to-[#f5d742]',
        'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
      ),
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const motionProps = shouldAnimate
      ? {
          whileHover: { scale: disabled || loading ? 1 : 1.02 },
          whileTap: { scale: disabled || loading ? 1 : 0.98 },
          transition: { type: 'spring', stiffness: 400, damping: 25 },
        }
      : {};

    return (
      <motion.button
        ref={ref}
        {...motionProps}
        className={cn(
          'relative overflow-hidden',
          'inline-flex items-center justify-center gap-2',
          'font-semibold uppercase tracking-wide',
          'border transition-all duration-fast ease-premium',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'outline-none',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {/* Ripple container */}
        <AnimatePresence>
          {ripples.map((r) => (
            <Ripple key={r.id} {...r} onComplete={() => removeRipple(r.id)} />
          ))}
        </AnimatePresence>

        {/* Button content */}
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {loading ? (
            <motion.span
              className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <>
              {icon && iconPosition === 'left' && (
                <motion.span
                  className="flex-shrink-0"
                  initial={shouldAnimate ? { x: -4, opacity: 0 } : undefined}
                  animate={shouldAnimate ? { x: 0, opacity: 1 } : undefined}
                  transition={{ duration: 0.2 }}
                >
                  {icon}
                </motion.span>
              )}
              {children}
              {icon && iconPosition === 'right' && (
                <motion.span
                  className="flex-shrink-0"
                  initial={shouldAnimate ? { x: 4, opacity: 0 } : undefined}
                  animate={shouldAnimate ? { x: 0, opacity: 1 } : undefined}
                  transition={{ duration: 0.2 }}
                >
                  {icon}
                </motion.span>
              )}
            </>
          )}
        </span>
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
