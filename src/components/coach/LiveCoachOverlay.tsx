'use client';

/**
 * LiveCoachOverlay Component
 *
 * A non-intrusive HUD element that provides real-time coaching updates.
 * Shows "Stream of Consciousness" messages from the proactive coach.
 *
 * Features:
 * - Market breadth status indicator
 * - Economic event countdown
 * - Active warnings/alerts
 * - Quick status bar (minimized view)
 * - Expandable detail panel
 *
 * "Market is heavy.", "VOLD is spiking.", "Good patience here."
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getMarketBreadth,
  getHotContext,
  type MarketBreadth,
  type MarketHotContext,
  type ProactiveWarning,
} from '@/lib/market-data';
import { voiceSynthesizer } from '@/lib/coaching-intervention-engine';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  ChevronUp,
  ChevronDown,
  X,
  Bell,
  BellOff,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface LiveCoachOverlayProps {
  className?: string;
  position?: 'top' | 'bottom';
  defaultExpanded?: boolean;
  refreshIntervalMs?: number;
  onWarningClick?: (warning: ProactiveWarning) => void;
}

type MarketStatus = 'green' | 'yellow' | 'red' | 'unknown';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatusIndicator({ status }: { status: MarketStatus }) {
  const colors: Record<MarketStatus, string> = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    unknown: 'bg-gray-500',
  };

  return (
    <div className={cn(
      'w-3 h-3 rounded-full animate-pulse',
      colors[status]
    )} />
  );
}

function BreadthIndicator({ breadth }: { breadth: MarketBreadth | null }) {
  if (!breadth) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Activity className="h-4 w-4" />
        <span>Breadth: Loading...</span>
      </div>
    );
  }

  const { add, tradingBias, healthScore } = breadth;

  const biasColor = {
    favor_longs: 'text-green-500',
    favor_shorts: 'text-red-500',
    neutral: 'text-gray-500',
    caution: 'text-yellow-500',
  };

  const BiasIcon = tradingBias === 'favor_longs' ? TrendingUp :
                   tradingBias === 'favor_shorts' ? TrendingDown : Activity;

  return (
    <div className="flex items-center gap-3">
      <BiasIcon className={cn('h-4 w-4', biasColor[tradingBias])} />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">ADD: {add.value > 0 ? '+' : ''}{add.value}</span>
        <span className={cn('text-sm font-medium', biasColor[tradingBias])}>
          {tradingBias.replace('_', ' ').toUpperCase()}
        </span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-xs text-muted-foreground">Health</span>
        <span className={cn(
          'text-sm font-bold',
          healthScore > 60 ? 'text-green-500' : healthScore > 40 ? 'text-yellow-500' : 'text-red-500'
        )}>
          {healthScore}
        </span>
      </div>
    </div>
  );
}

function EventCountdown({ event }: { event: MarketHotContext['calendar']['nextEvent'] }) {
  if (!event || event.minutesUntilEvent <= 0) {
    return null;
  }

  const isImminent = event.minutesUntilEvent <= 10;
  const isHigh = event.impact === 'high';

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1 rounded-full text-sm',
      isImminent && isHigh ? 'bg-red-500/20 text-red-500 animate-pulse' :
      isHigh ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-500'
    )}>
      <Clock className="h-3 w-3" />
      <span className="font-medium">
        {event.event}: {event.minutesUntilEvent}m
      </span>
      {isImminent && isHigh && (
        <AlertTriangle className="h-3 w-3" />
      )}
    </div>
  );
}

function WarningBanner({ warning, onDismiss }: {
  warning: ProactiveWarning;
  onDismiss?: () => void;
}) {
  const severityStyles = {
    critical: 'bg-red-500/20 border-red-500 text-red-500',
    warning: 'bg-yellow-500/20 border-yellow-500 text-yellow-500',
    info: 'bg-blue-500/20 border-blue-500 text-blue-500',
  };

  const severityIcons = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border',
      severityStyles[warning.severity]
    )}>
      <span className="text-lg">{severityIcons[warning.severity]}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{warning.title}</div>
        <div className="text-xs opacity-80 mt-0.5 line-clamp-2">{warning.message}</div>
        {warning.suggestedAction && (
          <div className="text-xs mt-1 font-medium">
            Action: {warning.suggestedAction}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-white/10 rounded"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function MarketCommentary({ breadth }: { breadth: MarketBreadth | null }) {
  if (!breadth) return null;

  const commentary = voiceSynthesizer.generateMarketCommentary(breadth);

  return (
    <div className="text-sm text-muted-foreground italic">
      "{commentary}"
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LiveCoachOverlay({
  className,
  position = 'bottom',
  defaultExpanded = false,
  refreshIntervalMs = 30000,
  onWarningClick,
}: LiveCoachOverlayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isMuted, setIsMuted] = useState(false);
  const [breadth, setBreadth] = useState<MarketBreadth | null>(null);
  const [hotContext, setHotContext] = useState<MarketHotContext | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [breadthData, contextData] = await Promise.all([
        getMarketBreadth(),
        getHotContext(),
      ]);
      setBreadth(breadthData);
      setHotContext(contextData);
    } catch (error) {
      console.error('[LiveCoachOverlay] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and interval
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData, refreshIntervalMs]);

  // Calculate market status
  const getMarketStatus = (): MarketStatus => {
    if (!hotContext) return 'unknown';
    return hotContext.tradingConditions?.status || 'unknown';
  };

  // Get active warnings (excluding dismissed)
  const activeWarnings = (hotContext?.activeWarnings || [])
    .filter(w => !dismissedWarnings.has(w.id));

  // Get critical/imminent warnings
  const criticalWarnings = activeWarnings.filter(w => w.severity === 'critical');
  const hasUrgentWarnings = criticalWarnings.length > 0 || hotContext?.calendar?.isEventImminent;

  // Dismiss warning
  const dismissWarning = (id: string) => {
    setDismissedWarnings(prev => new Set([...prev, id]));
  };

  // Minimized bar content
  const MinimizedBar = () => (
    <div className={cn(
      'flex items-center justify-between px-4 py-2 bg-card/95 backdrop-blur border rounded-lg shadow-lg cursor-pointer',
      hasUrgentWarnings && 'border-red-500/50 animate-pulse'
    )} onClick={() => setIsExpanded(true)}>
      <div className="flex items-center gap-4">
        <StatusIndicator status={getMarketStatus()} />
        <BreadthIndicator breadth={breadth} />
        {hotContext?.calendar?.nextEvent && (
          <EventCountdown event={hotContext.calendar.nextEvent} />
        )}
      </div>

      <div className="flex items-center gap-2">
        {activeWarnings.length > 0 && (
          <Badge variant={hasUrgentWarnings ? 'destructive' : 'secondary'}>
            {activeWarnings.length} {activeWarnings.length === 1 ? 'Alert' : 'Alerts'}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
          }}
        >
          {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </Button>
        <ChevronUp className="h-4 w-4" />
      </div>
    </div>
  );

  // Expanded panel content
  const ExpandedPanel = () => (
    <div className={cn(
      'bg-card/95 backdrop-blur border rounded-lg shadow-lg overflow-hidden',
      hasUrgentWarnings && 'border-red-500/50'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <StatusIndicator status={getMarketStatus()} />
          <span className="font-semibold">Live Coach</span>
          <Badge variant="outline" className="text-xs">
            {hotContext?.tradingConditions?.status?.toUpperCase() || 'LOADING'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
        {/* Market Breadth */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Market Breadth
          </h4>
          <div className="flex items-center justify-between">
            <BreadthIndicator breadth={breadth} />
            {breadth?.tick && (
              <div className="text-sm">
                <span className="text-muted-foreground">TICK: </span>
                <span className={cn(
                  'font-mono',
                  breadth.tick.current > 500 ? 'text-green-500' :
                  breadth.tick.current < -500 ? 'text-red-500' : 'text-muted-foreground'
                )}>
                  {breadth.tick.current > 0 ? '+' : ''}{breadth.tick.current}
                </span>
                {breadth.tick.extremeReading && (
                  <span className="ml-1 text-yellow-500">⚡</span>
                )}
              </div>
            )}
          </div>
          <MarketCommentary breadth={breadth} />
        </div>

        {/* Economic Calendar */}
        {hotContext?.calendar?.nextEvent && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Upcoming Event
            </h4>
            <EventCountdown event={hotContext.calendar.nextEvent} />
          </div>
        )}

        {/* Active Warnings */}
        {activeWarnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Active Alerts ({activeWarnings.length})
            </h4>
            <div className="space-y-2">
              {activeWarnings.slice(0, 3).map((warning) => (
                <WarningBanner
                  key={warning.id}
                  warning={warning}
                  onDismiss={() => dismissWarning(warning.id)}
                />
              ))}
              {activeWarnings.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  + {activeWarnings.length - 3} more alerts
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trading Conditions */}
        {hotContext?.tradingConditions && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Trading Conditions
            </h4>
            <div className="text-sm">
              {hotContext.tradingConditions.message}
            </div>
            {hotContext.tradingConditions.restrictions.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1">
                {hotContext.tradingConditions.restrictions.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(
        'fixed z-50 left-4 right-4',
        position === 'top' ? 'top-4' : 'bottom-4',
        className
      )}>
        <div className="flex items-center gap-3 px-4 py-2 bg-card/95 backdrop-blur border rounded-lg shadow-lg">
          <div className="h-3 w-3 rounded-full bg-gray-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">Loading coach...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'fixed z-50 left-4 right-4 max-w-xl mx-auto',
      position === 'top' ? 'top-4' : 'bottom-4',
      className
    )}>
      {isExpanded ? <ExpandedPanel /> : <MinimizedBar />}
    </div>
  );
}

export default LiveCoachOverlay;
