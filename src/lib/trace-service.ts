/**
 * Trace Service
 *
 * Handles logging and retrieval of coaching and alert traces
 * for reproducible evidence trails and debugging.
 */

import { supabaseAdmin } from './supabase';
import logger from './logger';
import type { CoachResponse } from './ai-output-schema';
import type { ScoreExplanation } from './ltp-engine';
import type { LTP2ScoreExplanation } from './ltp-gamma-engine';
import type { AIContext } from '@/types/ai';

// ============================================================================
// Types
// ============================================================================

export type CoachingTraceType = 'coaching' | 'analysis' | 'quick_action';
export type AlertTraceType = 'setup_alert' | 'admin_alert' | 'system_alert' | 'event_alert';

export interface CoachingTraceInput {
  traceType: CoachingTraceType;
  userId?: string;
  sessionId?: string;
  symbol?: string;
  timeframe?: string;
  inputSnapshot: {
    message: string;
    context: Partial<AIContext>;
    conversationHistory?: Array<{ role: string; content: string }>;
  };
  scoreExplanation?: ScoreExplanation | LTP2ScoreExplanation | null;
  aiResponse: CoachResponse;
  modelUsed?: string;
  tokensUsed?: { input: number; output: number };
  latencyMs?: number;
  usedFallback?: boolean;
}

export interface AlertTraceInput {
  traceType: AlertTraceType;
  triggeredBy?: string;
  symbol?: string;
  timeframe?: string;
  inputSnapshot: {
    marketData?: Record<string, unknown>;
    detectionResult?: Record<string, unknown>;
    threshold?: number;
    triggerReason: string;
  };
  scoreExplanation?: ScoreExplanation | LTP2ScoreExplanation | null;
  alertContent: {
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    alertType: string;
    targets?: string[];
  };
  deliveryStatus?: {
    discord?: 'sent' | 'failed' | 'skipped';
    push?: 'sent' | 'failed' | 'skipped';
    sse?: 'sent' | 'failed' | 'skipped';
  };
}

export interface CoachingTrace {
  id: string;
  trace_type: CoachingTraceType;
  user_id: string | null;
  session_id: string | null;
  symbol: string | null;
  timeframe: string | null;
  input_snapshot: CoachingTraceInput['inputSnapshot'];
  score_explanation: ScoreExplanation | LTP2ScoreExplanation | null;
  ai_response: CoachResponse;
  model_used: string;
  tokens_used: { input: number; output: number } | null;
  latency_ms: number | null;
  used_fallback: boolean;
  created_at: string;
}

export interface AlertTrace {
  id: string;
  trace_type: AlertTraceType;
  triggered_by: string | null;
  symbol: string | null;
  timeframe: string | null;
  input_snapshot: AlertTraceInput['inputSnapshot'];
  score_explanation: ScoreExplanation | LTP2ScoreExplanation | null;
  alert_content: AlertTraceInput['alertContent'];
  delivery_status: AlertTraceInput['deliveryStatus'] | null;
  created_at: string;
}

export type Trace = (CoachingTrace & { _table: 'coaching' }) | (AlertTrace & { _table: 'alert' });

export interface TraceFilters {
  table?: 'coaching' | 'alert' | 'all';
  symbol?: string;
  userId?: string;
  traceType?: string;
  startDate?: string;
  endDate?: string;
  usedFallback?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Log a coaching interaction trace.
 * This is called asynchronously - don't await in request path.
 */
export async function logCoachingTrace(input: CoachingTraceInput): Promise<string | null> {
  try {
    // Truncate large fields to prevent storage bloat
    const sanitizedInput = {
      ...input.inputSnapshot,
      message: input.inputSnapshot.message.slice(0, 2000),
      conversationHistory: input.inputSnapshot.conversationHistory?.slice(-5),
    };

    const { data, error } = await supabaseAdmin
      .from('coaching_traces')
      .insert({
        trace_type: input.traceType,
        user_id: input.userId || null,
        session_id: input.sessionId || null,
        symbol: input.symbol || null,
        timeframe: input.timeframe || null,
        input_snapshot: sanitizedInput,
        score_explanation: input.scoreExplanation || null,
        ai_response: input.aiResponse,
        model_used: input.modelUsed || 'claude-sonnet-4-20250514',
        tokens_used: input.tokensUsed || null,
        latency_ms: input.latencyMs || null,
        used_fallback: input.usedFallback || false,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to log coaching trace', {
        error: error.message,
        traceType: input.traceType,
        userId: input.userId,
      });
      return null;
    }

    return data.id;
  } catch (err) {
    logger.error('Exception logging coaching trace', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Log an alert generation trace.
 * This is called asynchronously - don't await in request path.
 */
export async function logAlertTrace(input: AlertTraceInput): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('alert_traces')
      .insert({
        trace_type: input.traceType,
        triggered_by: input.triggeredBy || null,
        symbol: input.symbol || null,
        timeframe: input.timeframe || null,
        input_snapshot: input.inputSnapshot,
        score_explanation: input.scoreExplanation || null,
        alert_content: input.alertContent,
        delivery_status: input.deliveryStatus || null,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to log alert trace', {
        error: error.message,
        traceType: input.traceType,
        symbol: input.symbol,
      });
      return null;
    }

    return data.id;
  } catch (err) {
    logger.error('Exception logging alert trace', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ============================================================================
// Retrieval Functions
// ============================================================================

/**
 * Get traces with filtering and pagination.
 */
export async function getTraces(filters: TraceFilters): Promise<{
  traces: Trace[];
  total: number;
  hasMore: boolean;
}> {
  const { table = 'all', limit = 50, offset = 0 } = filters;
  const traces: Trace[] = [];
  let total = 0;

  // Query coaching traces
  if (table === 'all' || table === 'coaching') {
    let query = supabaseAdmin
      .from('coaching_traces')
      .select('*', { count: 'exact' });

    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.traceType) {
      query = query.eq('trace_type', filters.traceType);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.usedFallback !== undefined) {
      query = query.eq('used_fallback', filters.usedFallback);
    }

    query = query.order('created_at', { ascending: false });

    if (table === 'coaching') {
      query = query.range(offset, offset + limit - 1);
    } else {
      // For 'all', take half from each table
      query = query.range(offset, offset + Math.floor(limit / 2) - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error('Failed to fetch coaching traces', { error: error.message });
    } else if (data) {
      traces.push(...data.map((t) => ({ ...t, _table: 'coaching' as const })));
      total += count || 0;
    }
  }

  // Query alert traces
  if (table === 'all' || table === 'alert') {
    let query = supabaseAdmin
      .from('alert_traces')
      .select('*', { count: 'exact' });

    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
    }
    if (filters.userId) {
      query = query.eq('triggered_by', filters.userId);
    }
    if (filters.traceType) {
      query = query.eq('trace_type', filters.traceType);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    query = query.order('created_at', { ascending: false });

    if (table === 'alert') {
      query = query.range(offset, offset + limit - 1);
    } else {
      // For 'all', take half from each table
      query = query.range(offset, offset + Math.floor(limit / 2) - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error('Failed to fetch alert traces', { error: error.message });
    } else if (data) {
      traces.push(...data.map((t) => ({ ...t, _table: 'alert' as const })));
      total += count || 0;
    }
  }

  // Sort combined results by created_at
  traces.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    traces: traces.slice(0, limit),
    total,
    hasMore: total > offset + limit,
  };
}

/**
 * Get a single trace by ID.
 */
export async function getTraceById(
  traceId: string,
  table: 'coaching' | 'alert'
): Promise<Trace | null> {
  const tableName = table === 'coaching' ? 'coaching_traces' : 'alert_traces';

  const { data, error } = await supabaseAdmin
    .from(tableName)
    .select('*')
    .eq('id', traceId)
    .single();

  if (error || !data) {
    logger.warn('Trace not found', { traceId, table, error: error?.message });
    return null;
  }

  return { ...data, _table: table } as Trace;
}

/**
 * Export trace as JSON for debugging.
 */
export async function exportTraceAsJson(
  traceId: string,
  table: 'coaching' | 'alert'
): Promise<object | null> {
  const trace = await getTraceById(traceId, table);

  if (!trace) {
    return null;
  }

  // Remove internal _table field
  const { _table, ...exportData } = trace;

  return {
    exportedAt: new Date().toISOString(),
    traceTable: _table,
    trace: exportData,
  };
}

// ============================================================================
// Stats
// ============================================================================

/**
 * Get trace statistics for admin dashboard.
 */
export async function getTraceStats(): Promise<{
  coachingTotal: number;
  coachingToday: number;
  coachingFallbackRate: number;
  alertsTotal: number;
  alertsToday: number;
}> {
  const today = new Date().toISOString().split('T')[0];

  // Coaching stats
  const { count: coachingTotal } = await supabaseAdmin
    .from('coaching_traces')
    .select('*', { count: 'exact', head: true });

  const { count: coachingToday } = await supabaseAdmin
    .from('coaching_traces')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);

  const { count: coachingFallback } = await supabaseAdmin
    .from('coaching_traces')
    .select('*', { count: 'exact', head: true })
    .eq('used_fallback', true);

  // Alert stats
  const { count: alertsTotal } = await supabaseAdmin
    .from('alert_traces')
    .select('*', { count: 'exact', head: true });

  const { count: alertsToday } = await supabaseAdmin
    .from('alert_traces')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);

  const fallbackRate = coachingTotal && coachingTotal > 0
    ? ((coachingFallback || 0) / coachingTotal) * 100
    : 0;

  return {
    coachingTotal: coachingTotal || 0,
    coachingToday: coachingToday || 0,
    coachingFallbackRate: Math.round(fallbackRate * 100) / 100,
    alertsTotal: alertsTotal || 0,
    alertsToday: alertsToday || 0,
  };
}
