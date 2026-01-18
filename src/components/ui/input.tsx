'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
              'px-4 py-3 text-sm text-[var(--text-primary)]',
              'placeholder:text-[var(--text-tertiary)]',
              'transition-colors duration-150',
              'focus:outline-none focus:border-[var(--accent-primary)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-[var(--error)] focus:border-[var(--error)]',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-[var(--error)]">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
            'px-4 py-3 text-sm text-[var(--text-primary)]',
            'transition-colors duration-150',
            'focus:outline-none focus:border-[var(--accent-primary)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'appearance-none cursor-pointer',
            error && 'border-[var(--error)] focus:border-[var(--error)]',
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1.5 text-xs text-[var(--error)]">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
            'px-4 py-3 text-sm text-[var(--text-primary)]',
            'placeholder:text-[var(--text-tertiary)]',
            'transition-colors duration-150',
            'focus:outline-none focus:border-[var(--accent-primary)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'resize-none',
            error && 'border-[var(--error)] focus:border-[var(--error)]',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-[var(--error)]">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Input, Select, Textarea };
