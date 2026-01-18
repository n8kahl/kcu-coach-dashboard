'use client';

import { forwardRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, type HTMLMotionProps, useMotionValue, useSpring, useTransform } from 'framer-motion';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  variant?: 'default' | 'elevated' | 'bordered' | 'glow' | 'premium';
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Enable 3D tilt effect on hover */
  tilt?: boolean;
  /** Disable entrance animation */
  disableAnimation?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({
    className,
    variant = 'default',
    hoverable = false,
    padding = 'md',
    tilt = false,
    disableAnimation = false,
    children,
    onMouseMove,
    onMouseLeave,
    ...props
  }, ref) => {
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

    // 3D tilt effect values
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), {
      stiffness: 300,
      damping: 30,
    });
    const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), {
      stiffness: 300,
      damping: 30,
    });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (tilt && shouldAnimate) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        mouseX.set(x);
        mouseY.set(y);
      }
      onMouseMove?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (tilt && shouldAnimate) {
        mouseX.set(0);
        mouseY.set(0);
      }
      onMouseLeave?.(e);
    };

    const variants = {
      default: 'bg-[var(--bg-card)] border border-[var(--border-primary)]',
      elevated: 'bg-[var(--bg-elevated)] border border-[var(--border-secondary)] shadow-[var(--shadow-md)]',
      bordered: 'bg-transparent border-2 border-[var(--border-secondary)]',
      glow: 'bg-[var(--bg-card)] border-2 border-[var(--accent-primary)] shadow-glow-md',
      premium: cn(
        'bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-elevated)]',
        'border border-[var(--border-accent)]',
        'shadow-card-hover'
      ),
    };

    const paddings = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    const hoverStyles = hoverable
      ? cn(
          'transition-all duration-normal ease-premium cursor-pointer',
          'hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-accent)]',
          'hover:shadow-card-hover hover:-translate-y-1',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
        )
      : '';

    const motionProps = shouldAnimate
      ? {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
        }
      : {};

    const tiltProps = tilt && shouldAnimate
      ? {
          style: {
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d' as const,
          },
        }
      : {};

    return (
      <motion.div
        ref={ref}
        {...motionProps}
        {...tiltProps}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={cn(variants[variant], paddings[padding], hoverStyles, className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, subtitle, action, icon, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between mb-4', className)}
        {...props}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-[var(--accent-primary)]">{icon}</span>}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-primary)]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('', className)} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('mt-4 pt-4 border-t border-[var(--border-primary)]', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardContent, CardFooter };
