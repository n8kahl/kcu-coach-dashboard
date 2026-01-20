'use client';

/**
 * TradeInterceptorModal Component
 *
 * Modal dialog shown when a trade is blocked or warned by the intervention engine.
 * Provides clear feedback on why the trade was flagged and what to do next.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InterventionResult, InterventionSeverity } from '@/lib/coaching-intervention-engine';
import { AlertTriangle, XCircle, AlertCircle, BookOpen, X } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface TradeInterceptorModalProps {
  open: boolean;
  onClose: () => void;
  result: InterventionResult | null;
  onOverride?: () => void;
  canOverride?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function getSeverityConfig(severity: InterventionSeverity) {
  switch (severity) {
    case 'dumb_shit':
      return {
        icon: XCircle,
        iconColor: 'text-red-500',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/50',
        badgeVariant: 'error' as const,
        title: 'TRADE BLOCKED',
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        iconColor: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/50',
        badgeVariant: 'warning' as const,
        title: 'CAUTION',
      };
    case 'nudge':
    default:
      return {
        icon: AlertCircle,
        iconColor: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/50',
        badgeVariant: 'info' as const,
        title: 'NOTE',
      };
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TradeInterceptorModal({
  open,
  onClose,
  result,
  onOverride,
  canOverride = false,
}: TradeInterceptorModalProps) {
  if (!result) return null;

  const config = getSeverityConfig(result.severity);
  const Icon = config.icon;
  const isBlocked = !result.approved;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(
        'max-w-md',
        config.borderColor,
        config.bgColor
      )}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-full',
              result.severity === 'dumb_shit' ? 'bg-red-500/20' :
              result.severity === 'warning' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
            )}>
              <Icon className={cn('h-6 w-6', config.iconColor)} />
            </div>
            <div>
              <Badge variant={config.badgeVariant}>
                {config.title}
              </Badge>
              <DialogTitle className="text-lg mt-1">
                {result.title}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main Message */}
          <div className="text-sm whitespace-pre-wrap">
            {result.message}
          </div>

          {/* Technical Reason (for debugging/learning) */}
          {result.technicalReason && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
              {result.technicalReason}
            </div>
          )}

          {/* Warnings List */}
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5">•</span>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Suggested Action */}
          {result.suggestedAction && (
            <div className={cn(
              'p-3 rounded-lg border',
              result.severity === 'dumb_shit' ? 'border-red-500/30 bg-red-500/5' :
              result.severity === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
              'border-blue-500/30 bg-blue-500/5'
            )}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Suggested Action
              </div>
              <div className="text-sm">
                {result.suggestedAction}
              </div>
            </div>
          )}

          {/* Related Lesson */}
          {result.relatedLesson && (
            <a
              href={result.relatedLesson.url}
              className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <BookOpen className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Related Lesson</div>
                <div className="text-sm font-medium text-primary">
                  {result.relatedLesson.module} / {result.relatedLesson.lesson}
                </div>
              </div>
            </a>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {/* Override button for warnings (not blocks) */}
          {canOverride && !isBlocked && onOverride && (
            <Button
              variant="secondary"
              onClick={onOverride}
              className="text-yellow-600 border-yellow-500/50 hover:bg-yellow-500/10"
            >
              I Understand, Proceed Anyway
            </Button>
          )}

          {/* Close button */}
          <Button
            variant={isBlocked ? 'danger' : 'primary'}
            onClick={onClose}
          >
            {isBlocked ? 'Close and Cancel Trade' : 'Got It'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TradeInterceptorModal;
