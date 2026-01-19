'use client';

/**
 * SharpButton - Premium Trading Terminal Button
 *
 * A demonstration component showcasing the KCU Design System tokens:
 * - Sharp corners (0px border-radius) via Tailwind override
 * - kcu-gold color palette
 * - border-thin utility
 * - Terminal-style aesthetics
 *
 * Usage:
 *   <SharpButton variant="primary">Execute Trade</SharpButton>
 *   <SharpButton variant="secondary" icon={<ChartIcon />}>View Chart</SharpButton>
 *   <SharpButton variant="ghost" size="sm">Cancel</SharpButton>
 */

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SharpButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

const SharpButton = forwardRef<HTMLButtonElement, SharpButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Base styles - sharp terminal aesthetic
    const baseStyles = cn(
      // Layout
      'inline-flex items-center justify-center gap-2',
      // Typography - uppercase trading terminal style
      'font-semibold uppercase tracking-wide',
      // Sharp corners (enforced by tailwind config, but explicit here for clarity)
      'rounded-none',
      // Border
      'border',
      // Transitions
      'transition-all duration-150 ease-out',
      // States
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-kcu-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0d]'
    );

    // Variant styles using new kcu-gold tokens
    const variantStyles = {
      primary: cn(
        // KCU Gold primary button
        'bg-kcu-gold text-[#0d0d0d] border-kcu-gold',
        'hover:bg-kcu-gold-600 hover:border-kcu-gold-600',
        'hover:shadow-kcu-glow-md',
        'active:scale-[0.98]'
      ),
      secondary: cn(
        // Terminal border style
        'bg-transparent text-[var(--text-primary)]',
        'border-terminal-border',
        'hover:border-kcu-gold hover:text-kcu-gold',
        'active:bg-kcu-gold-dim'
      ),
      ghost: cn(
        // Subtle ghost button
        'bg-transparent text-[var(--text-secondary)] border-transparent',
        'hover:text-[var(--text-primary)] hover:bg-white/5',
        'active:bg-white/10'
      ),
      danger: cn(
        // Danger/destructive action
        'bg-[var(--error)] text-white border-[var(--error)]',
        'hover:bg-[#dc2626] hover:shadow-loss',
        'active:scale-[0.98]'
      ),
    };

    // Size styles
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <span className="flex-shrink-0">{icon}</span>
            )}
            {children}
            {icon && iconPosition === 'right' && (
              <span className="flex-shrink-0">{icon}</span>
            )}
          </>
        )}
      </button>
    );
  }
);

SharpButton.displayName = 'SharpButton';

export { SharpButton };

/**
 * SharpIconButton - Square icon-only button variant
 */
export interface SharpIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const SharpIconButton = forwardRef<HTMLButtonElement, SharpIconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', children, ...props }, ref) => {
    const sizeStyles = {
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-12 h-12',
    };

    const variantStyles = {
      primary: 'bg-kcu-gold text-[#0d0d0d] hover:bg-kcu-gold-600 hover:shadow-kcu-glow-sm',
      secondary: 'border-thin text-[var(--text-secondary)] hover:text-kcu-gold hover:border-kcu-gold',
      ghost: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center',
          'rounded-none transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-kcu-gold',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

SharpIconButton.displayName = 'SharpIconButton';

export { SharpIconButton };

/**
 * Example usage with the design system:
 *
 * ```tsx
 * import { SharpButton, SharpIconButton } from '@/components/ui/sharp-button';
 * import { Play, Settings, X } from 'lucide-react';
 *
 * // Primary action
 * <SharpButton variant="primary" icon={<Play className="w-4 h-4" />}>
 *   Start Practice
 * </SharpButton>
 *
 * // Secondary action with terminal border
 * <SharpButton variant="secondary">
 *   View History
 * </SharpButton>
 *
 * // Ghost button for subtle actions
 * <SharpButton variant="ghost" size="sm">
 *   Cancel
 * </SharpButton>
 *
 * // Icon-only button
 * <SharpIconButton variant="ghost">
 *   <Settings className="w-5 h-5" />
 * </SharpIconButton>
 *
 * // Full-width loading button
 * <SharpButton variant="primary" fullWidth loading>
 *   Processing...
 * </SharpButton>
 * ```
 *
 * CSS Classes available for direct use:
 * - btn-sharp-primary: Gold background, sharp corners
 * - btn-sharp-secondary: Transparent with terminal border
 * - btn-sharp-ghost: No background, subtle hover
 * - input-terminal: Bloomberg-style underline input
 * - border-thin: 1px #333 border
 * - card-terminal: Sharp-cornered panel
 */
