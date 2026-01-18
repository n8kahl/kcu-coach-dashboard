'use client';

import { createContext, useContext, useState, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, value: controlledValue, onValueChange, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const value = controlledValue ?? internalValue;

    const onChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };

    return (
      <TabsContext.Provider value={{ value, onChange }}>
        <div ref={ref} className={cn('w-full', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = 'Tabs';

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'underline' | 'pills';
}

const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-1 gap-1',
      underline: 'border-b border-[var(--border-primary)] gap-0',
      pills: 'gap-2',
    };

    return (
      <div
        ref={ref}
        role="tablist"
        className={cn('flex items-center', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  variant?: 'default' | 'underline' | 'pills';
}

const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, variant = 'default', children, ...props }, ref) => {
    const { value: selectedValue, onChange } = useTabsContext();
    const isSelected = selectedValue === value;

    const baseStyles = 'relative px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors duration-150';

    const variants = {
      default: cn(
        baseStyles,
        isSelected
          ? 'bg-[var(--bg-card)] text-[var(--accent-primary)]'
          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
      ),
      underline: cn(
        baseStyles,
        'border-b-2 -mb-px',
        isSelected
          ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
          : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-secondary)]'
      ),
      pills: cn(
        baseStyles,
        isSelected
          ? 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)] border border-[var(--accent-primary-muted)]'
          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent hover:border-[var(--border-secondary)]'
      ),
    };

    return (
      <button
        ref={ref}
        role="tab"
        type="button"
        aria-selected={isSelected}
        onClick={() => onChange(value)}
        className={cn(variants[variant], className)}
        {...props}
      >
        {children}
        {variant === 'default' && isSelected && (
          <motion.div
            layoutId="tab-indicator"
            className="absolute inset-0 bg-[var(--bg-card)]"
            style={{ zIndex: -1 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </button>
    );
  }
);

TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps {
  value: string;
  className?: string;
  children?: React.ReactNode;
}

const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children }, ref) => {
    const { value: selectedValue } = useTabsContext();
    const isSelected = selectedValue === value;

    if (!isSelected) return null;

    return (
      <motion.div
        ref={ref}
        role="tabpanel"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={cn('mt-4', className)}
      >
        {children}
      </motion.div>
    );
  }
);

TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
