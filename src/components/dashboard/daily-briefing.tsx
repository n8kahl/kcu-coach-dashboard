'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sun,
  Moon,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Calendar,
  Target,
  BookOpen,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Briefing {
  id: string;
  briefingType: string;
  generatedAt: string;
  content: {
    headline: string;
    summary: string;
    marketBias: 'bullish' | 'bearish' | 'neutral';
    actionItems: string[];
    warnings?: string[];
  };
  marketContext: {
    spyPrice: number;
    spyChange: number;
    spyTrend: string;
    qqqPrice: number;
    qqqChange: number;
    qqqTrend: string;
    overallSentiment: string;
  };
  keyLevels: Array<{
    symbol: string;
    currentPrice: number;
    levels: Array<{ price: number; type: string; strength: number }>;
  }>;
  setups: Array<{
    symbol: string;
    direction: string;
    setupType: string;
    levelScore: number;
    trendScore: number;
    note: string;
  }>;
  economicEvents: Array<{
    eventName: string;
    eventTime?: string;
    impact: string;
  }>;
  earnings?: Array<{
    symbol: string;
    companyName: string;
    reportDate: string;
    reportTime: 'bmo' | 'amc' | 'dmh';
    fiscalQuarter: string;
  }>;
  lessonOfDay?: {
    title: string;
    content: string;
  };
}

interface DailyBriefingProps {
  className?: string;
}

export function DailyBriefing({ className }: DailyBriefingProps) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [isStale, setIsStale] = useState(false);

  const fetchBriefing = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/briefings?type=morning');
      if (res.ok) {
        const data = await res.json();
        setBriefing(data.briefing);
        setIsStale(data.isStale || false);
      }
    } catch (error) {
      console.error('Error fetching briefing:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  const getBiasIcon = () => {
    if (!briefing) return <Minus className="w-5 h-5" />;
    switch (briefing.content.marketBias) {
      case 'bullish': return <TrendingUp className="w-5 h-5 text-[var(--profit)]" />;
      case 'bearish': return <TrendingDown className="w-5 h-5 text-[var(--loss)]" />;
      default: return <Minus className="w-5 h-5 text-[var(--text-tertiary)]" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)] mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (!briefing) {
    return (
      <Card className={className}>
        <CardHeader
          title="Daily Briefing"
          icon={<Sun className="w-5 h-5 text-[var(--accent-primary)]" />}
        />
        <CardContent className="text-center py-6">
          <p className="text-[var(--text-tertiary)] mb-4">No briefing available yet.</p>
          <Button variant="ghost" size="sm" onClick={fetchBriefing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader
        title="Daily Briefing"
        icon={<Sun className="w-5 h-5 text-[var(--accent-primary)]" />}
        action={
          <div className="flex items-center gap-2">
            {isStale && (
              <Badge variant="warning" size="sm">Stale</Badge>
            )}
            <span className="text-xs text-[var(--text-tertiary)]">
              {formatTime(briefing.generatedAt)}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        }
      />
      <CardContent className="space-y-4">
        {/* Headline */}
        <div className="flex items-center gap-3">
          {getBiasIcon()}
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">
              {briefing.content.headline}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {briefing.content.summary}
            </p>
          </div>
        </div>

        {/* Market Context Quick View */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1">SPY</div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold">${briefing.marketContext.spyPrice.toFixed(2)}</span>
              <span className={`text-sm ${
                briefing.marketContext.spyChange >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
              }`}>
                {briefing.marketContext.spyChange >= 0 ? '+' : ''}{briefing.marketContext.spyChange.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1">QQQ</div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold">${briefing.marketContext.qqqPrice.toFixed(2)}</span>
              <span className={`text-sm ${
                briefing.marketContext.qqqChange >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
              }`}>
                {briefing.marketContext.qqqChange >= 0 ? '+' : ''}{briefing.marketContext.qqqChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {briefing.content.warnings && briefing.content.warnings.length > 0 && (
          <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--warning)] mt-0.5" />
              <div className="text-sm text-[var(--warning)]">
                {briefing.content.warnings.map((warning, i) => (
                  <p key={i}>{warning}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expanded Content */}
        {expanded && (
          <>
            {/* Economic Events */}
            {briefing.economicEvents && briefing.economicEvents.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Economic Events
                </h4>
                <div className="space-y-1">
                  {briefing.economicEvents.map((event, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">{event.eventName}</span>
                      <div className="flex items-center gap-2">
                        {event.eventTime && (
                          <span className="text-xs text-[var(--text-tertiary)]">{event.eventTime}</span>
                        )}
                        <Badge
                          variant={event.impact === 'high' ? 'error' : event.impact === 'medium' ? 'warning' : 'default'}
                          size="sm"
                        >
                          {event.impact}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Earnings */}
            {briefing.earnings && briefing.earnings.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Upcoming Earnings
                </h4>
                <div className="space-y-1">
                  {briefing.earnings.map((earning, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-[var(--bg-tertiary)] rounded p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{earning.symbol}</span>
                        <span className="text-[var(--text-tertiary)] text-xs">{earning.fiscalQuarter}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {new Date(earning.reportDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <Badge
                          variant={earning.reportTime === 'bmo' ? 'warning' : 'default'}
                          size="sm"
                        >
                          {earning.reportTime === 'bmo' ? 'Pre-Market' :
                           earning.reportTime === 'amc' ? 'After Close' : 'During'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LTP Setups */}
            {briefing.setups && briefing.setups.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Potential Setups
                </h4>
                <div className="space-y-2">
                  {briefing.setups.map((setup, i) => (
                    <div key={i} className="flex items-center justify-between bg-[var(--bg-tertiary)] rounded p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{setup.symbol}</span>
                        <Badge
                          variant={setup.direction === 'long' ? 'success' : 'error'}
                          size="sm"
                        >
                          {setup.direction.toUpperCase()}
                        </Badge>
                      </div>
                      <span className="text-xs text-[var(--text-tertiary)]">{setup.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Action Items</h4>
              <ul className="space-y-1">
                {briefing.content.actionItems.map((item, i) => (
                  <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                    <span className="text-[var(--accent-primary)]">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Lesson of Day */}
            {briefing.lessonOfDay && (
              <div className="bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <BookOpen className="w-4 h-4 text-[var(--accent-primary)] mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--accent-primary)] mb-1">
                      {briefing.lessonOfDay.title}
                    </h4>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {briefing.lessonOfDay.content}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!expanded && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setExpanded(true)}
          >
            Show More
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
