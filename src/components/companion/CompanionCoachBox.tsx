'use client';

/**
 * CompanionCoachBox
 *
 * A floating terminal that displays real-time coaching messages based on
 * market analysis. Extracted from the monolithic companion page.
 */

import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Sparkles,
  Minimize2,
  Target,
  X,
} from 'lucide-react';
import type { CoachingMessage } from '@/lib/kcu-coaching-rules';

// ============================================================================
// TYPES
// ============================================================================

export type CoachingMode = 'scan' | 'focus' | 'trade';
export type AlertType = 'patience' | 'entry' | 'warning' | null;

// ============================================================================
// PROPS
// ============================================================================

export interface CompanionCoachBoxProps {
  messages: CoachingMessage[];
  expanded: boolean;
  onToggle: () => void;
  alertType: AlertType;
  selectedSymbol: string | null;
  mode: CoachingMode;
  className?: string;
  // Mobile responsiveness
  isOverlay?: boolean;
  onClose?: () => void;
  /** Sidebar mode: simplified layout, always expanded, no minimize button */
  sidebarMode?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CompanionCoachBox({
  messages,
  expanded,
  onToggle,
  alertType,
  selectedSymbol,
  mode,
  className,
  isOverlay = false,
  onClose,
  sidebarMode = false,
}: CompanionCoachBoxProps) {
  // In sidebar mode, always treat as expanded
  const isExpanded = sidebarMode || expanded;
  const borderColor =
    alertType === 'entry'
      ? 'border-[var(--success)]'
      : alertType === 'patience'
      ? 'border-[var(--warning)]'
      : alertType === 'warning'
      ? 'border-[var(--error)]'
      : 'border-[var(--border-primary)]';

  const glowEffect =
    alertType === 'entry'
      ? 'shadow-[0_0_20px_rgba(34,197,94,0.3)]'
      : alertType === 'patience'
      ? 'shadow-[0_0_20px_rgba(251,191,36,0.3)]'
      : alertType === 'warning'
      ? 'shadow-[0_0_20px_rgba(239,68,68,0.3)]'
      : '';

  // Collapsed state - shows as a floating button (not in sidebar mode)
  if (!isExpanded && !isOverlay && !sidebarMode) {
    return (
      <button
        onClick={onToggle}
        className={cn(
          'w-10 h-10 rounded-lg bg-[#0d0d0d]/90 backdrop-blur border',
          'flex items-center justify-center transition-all duration-300',
          borderColor,
          glowEffect,
          alertType && 'animate-pulse',
          className
        )}
      >
        <MessageSquare
          className={cn(
            'w-4 h-4',
            alertType === 'entry'
              ? 'text-[var(--success)]'
              : alertType === 'patience'
              ? 'text-[var(--warning)]'
              : alertType === 'warning'
              ? 'text-[var(--error)]'
              : 'text-[var(--accent-primary)]'
          )}
        />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'bg-[#0d0d0d]/95 backdrop-blur border rounded-lg overflow-hidden transition-all duration-300',
        borderColor,
        glowEffect,
        isOverlay ? 'w-full h-full flex flex-col' : '',
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 border-b',
          alertType === 'entry'
            ? 'border-[var(--success)] bg-[var(--success)]/10'
            : alertType === 'patience'
            ? 'border-[var(--warning)] bg-[var(--warning)]/10'
            : alertType === 'warning'
            ? 'border-[var(--error)] bg-[var(--error)]/10'
            : 'border-[var(--border-primary)]'
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles
            className={cn(
              'w-4 h-4',
              alertType === 'entry'
                ? 'text-[var(--success)]'
                : alertType === 'patience'
                ? 'text-[var(--warning)]'
                : alertType === 'warning'
                ? 'text-[var(--error)]'
                : 'text-[var(--accent-primary)]'
            )}
          />
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Digital Somesh
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase">
            {mode}
          </span>
          {isOverlay && onClose ? (
            <button
              onClick={onClose}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          ) : !sidebarMode && (
            <button
              onClick={onToggle}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className={cn(
          'p-3 space-y-3 overflow-y-auto',
          isOverlay ? 'flex-1' : 'max-h-64'
        )}
      >
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              {selectedSymbol
                ? 'Analyzing setup...'
                : 'Select a symbol to get coaching'}
            </p>
          </div>
        ) : (
          messages.slice(0, 4).map((msg, i) => (
            <CoachMessage key={i} message={msg} isPrimary={i === 0} />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COACH MESSAGE COMPONENT
// ============================================================================

interface CoachMessageProps {
  message: CoachingMessage;
  isPrimary: boolean;
}

function CoachMessage({ message, isPrimary }: CoachMessageProps) {
  const typeStyles: Record<string, string> = {
    opportunity: 'border-l-[var(--success)]',
    warning: 'border-l-[var(--error)]',
    guidance: 'border-l-[var(--accent-primary)]',
    education: 'border-l-[var(--info)]',
    trade_management: 'border-l-[var(--warning)]',
  };

  return (
    <div
      className={cn(
        'border-l-2 pl-3 py-1',
        typeStyles[message.type] || 'border-l-[var(--border-primary)]',
        isPrimary && 'bg-[var(--bg-tertiary)]/50 -mx-3 px-3 rounded-r'
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'text-xs font-bold',
            isPrimary
              ? 'text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)]'
          )}
        >
          {message.title}
        </span>
      </div>
      <p
        className={cn(
          'text-[11px] leading-relaxed mt-1',
          isPrimary
            ? 'text-[var(--text-secondary)]'
            : 'text-[var(--text-tertiary)]'
        )}
      >
        {message.message}
      </p>
      {message.action && isPrimary && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--accent-primary)]">
          <Target className="w-3 h-3" />
          <span>{message.action}</span>
        </div>
      )}
    </div>
  );
}

export default CompanionCoachBox;
