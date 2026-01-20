/**
 * Earnings Calendar Service
 *
 * Fetches and manages earnings calendar data.
 * Uses Polygon API to get upcoming earnings announcements.
 */

import { supabaseAdmin } from './supabase';
import logger from './logger';

export interface EarningsEvent {
  id?: string;
  symbol: string;
  companyName: string;
  reportDate: string;
  fiscalQuarter: string;
  fiscalYear: number;
  reportTime: 'bmo' | 'amc' | 'dmh'; // before market open, after market close, during market hours
  estimatedEps?: number;
  actualEps?: number;
  estimatedRevenue?: number;
  actualRevenue?: number;
  surprise?: number;
}

/**
 * Fetch upcoming earnings from Polygon API
 */
export async function fetchUpcomingEarnings(
  symbols: string[]
): Promise<EarningsEvent[]> {
  try {
    const apiKey = process.env.MASSIVE_API_KEY;
    if (!apiKey) {
      logger.warn('MASSIVE_API_KEY not configured, cannot fetch earnings');
      return [];
    }

    const earnings: EarningsEvent[] = [];
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Massive.com earnings endpoint
    for (const symbol of symbols) {
      try {
        const url = `https://api.massive.com/v3/reference/tickers/${symbol}/events?types=earnings&apiKey=${apiKey}`;
        const res = await fetch(url);

        if (!res.ok) continue;

        const data = await res.json();

        if (data.results?.events) {
          for (const event of data.results.events) {
            if (event.date >= today && event.date <= futureDate) {
              earnings.push({
                symbol: symbol.toUpperCase(),
                companyName: data.results.name || symbol,
                reportDate: event.date,
                fiscalQuarter: event.fiscal_quarter || 'Q?',
                fiscalYear: event.fiscal_year || new Date().getFullYear(),
                reportTime: event.timing === 'before_open' ? 'bmo' :
                           event.timing === 'after_close' ? 'amc' : 'dmh',
              });
            }
          }
        }
      } catch {
        // Skip symbol on error
      }
    }

    return earnings;

  } catch (error) {
    logger.error('Error fetching earnings', error instanceof Error ? error : { message: String(error) });
    return [];
  }
}

/**
 * Get today's earnings from database
 */
export async function getTodayEarnings(): Promise<EarningsEvent[]> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('earnings_calendar')
      .select('*')
      .eq('report_date', today)
      .order('report_time', { ascending: true });

    if (error) {
      logger.error('Error fetching today earnings', { error: error.message });
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      symbol: row.symbol,
      companyName: row.company_name,
      reportDate: row.report_date,
      fiscalQuarter: row.fiscal_quarter,
      fiscalYear: row.fiscal_year,
      reportTime: row.report_time,
      estimatedEps: row.estimated_eps,
      actualEps: row.actual_eps,
      estimatedRevenue: row.estimated_revenue,
      actualRevenue: row.actual_revenue,
      surprise: row.surprise,
    }));

  } catch (error) {
    logger.error('Error in getTodayEarnings', error instanceof Error ? error : { message: String(error) });
    return [];
  }
}

/**
 * Get upcoming earnings (next N days)
 */
export async function getUpcomingEarnings(days = 7): Promise<EarningsEvent[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('earnings_calendar')
      .select('*')
      .gte('report_date', today)
      .lte('report_date', endDate)
      .order('report_date', { ascending: true })
      .order('report_time', { ascending: true });

    if (error) {
      logger.error('Error fetching upcoming earnings', { error: error.message });
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      symbol: row.symbol,
      companyName: row.company_name,
      reportDate: row.report_date,
      fiscalQuarter: row.fiscal_quarter,
      fiscalYear: row.fiscal_year,
      reportTime: row.report_time,
      estimatedEps: row.estimated_eps,
      actualEps: row.actual_eps,
      estimatedRevenue: row.estimated_revenue,
      actualRevenue: row.actual_revenue,
      surprise: row.surprise,
    }));

  } catch (error) {
    logger.error('Error in getUpcomingEarnings', error instanceof Error ? error : { message: String(error) });
    return [];
  }
}

/**
 * Add or update earnings events
 */
export async function upsertEarningsEvents(
  events: EarningsEvent[]
): Promise<{ success: boolean; count: number }> {
  try {
    const records = events.map(e => ({
      symbol: e.symbol.toUpperCase(),
      company_name: e.companyName,
      report_date: e.reportDate,
      fiscal_quarter: e.fiscalQuarter,
      fiscal_year: e.fiscalYear,
      report_time: e.reportTime,
      estimated_eps: e.estimatedEps,
      actual_eps: e.actualEps,
      estimated_revenue: e.estimatedRevenue,
      actual_revenue: e.actualRevenue,
      surprise: e.surprise,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('earnings_calendar')
      .upsert(records, {
        onConflict: 'symbol,report_date',
      });

    if (error) {
      logger.error('Error upserting earnings', { error: error.message });
      return { success: false, count: 0 };
    }

    return { success: true, count: records.length };

  } catch (error) {
    logger.error('Error in upsertEarningsEvents', error instanceof Error ? error : { message: String(error) });
    return { success: false, count: 0 };
  }
}

/**
 * Check if any watchlist symbols have earnings this week
 */
export async function getWatchlistEarnings(symbols: string[], days = 7): Promise<EarningsEvent[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('earnings_calendar')
      .select('*')
      .in('symbol', symbols.map(s => s.toUpperCase()))
      .gte('report_date', today)
      .lte('report_date', endDate)
      .order('report_date', { ascending: true });

    if (error) {
      logger.error('Error fetching watchlist earnings', { error: error.message });
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      symbol: row.symbol,
      companyName: row.company_name,
      reportDate: row.report_date,
      fiscalQuarter: row.fiscal_quarter,
      fiscalYear: row.fiscal_year,
      reportTime: row.report_time,
      estimatedEps: row.estimated_eps,
      actualEps: row.actual_eps,
      estimatedRevenue: row.estimated_revenue,
      actualRevenue: row.actual_revenue,
      surprise: row.surprise,
    }));

  } catch (error) {
    logger.error('Error in getWatchlistEarnings', error instanceof Error ? error : { message: String(error) });
    return [];
  }
}

/**
 * Get earnings summary for briefing
 */
export async function getEarningsSummary(): Promise<{
  todayCount: number;
  upcomingCount: number;
  todayEarnings: EarningsEvent[];
  upcomingEarnings: EarningsEvent[];
  warning?: string;
}> {
  const [todayEarnings, upcomingEarnings] = await Promise.all([
    getTodayEarnings(),
    getUpcomingEarnings(7),
  ]);

  let warning: string | undefined;
  if (todayEarnings.length > 0) {
    const symbols = todayEarnings.map(e => e.symbol).join(', ');
    warning = `Earnings today: ${symbols}. Expect increased volatility.`;
  }

  return {
    todayCount: todayEarnings.length,
    upcomingCount: upcomingEarnings.length,
    todayEarnings,
    upcomingEarnings,
    warning,
  };
}

/**
 * Format report time for display
 */
export function formatReportTime(time: 'bmo' | 'amc' | 'dmh'): string {
  switch (time) {
    case 'bmo': return 'Before Market';
    case 'amc': return 'After Close';
    case 'dmh': return 'During Hours';
    default: return time;
  }
}
