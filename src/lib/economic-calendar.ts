/**
 * Economic Calendar Service
 *
 * Fetches and manages economic calendar events.
 * Uses free APIs to get high-impact events.
 */

import { supabaseAdmin } from './supabase';
import logger from './logger';

export interface EconomicEvent {
  id?: string;
  eventDate: string;
  eventTime?: string;
  eventName: string;
  country: string;
  impact: 'low' | 'medium' | 'high';
  previousValue?: string;
  forecastValue?: string;
  actualValue?: string;
  description?: string;
}

// Key US economic events to track
const KEY_EVENTS = [
  { name: 'FOMC Interest Rate Decision', impact: 'high' as const },
  { name: 'Non-Farm Payrolls', impact: 'high' as const },
  { name: 'CPI', impact: 'high' as const },
  { name: 'Core CPI', impact: 'high' as const },
  { name: 'PPI', impact: 'high' as const },
  { name: 'GDP', impact: 'high' as const },
  { name: 'Unemployment Rate', impact: 'high' as const },
  { name: 'Initial Jobless Claims', impact: 'medium' as const },
  { name: 'Retail Sales', impact: 'medium' as const },
  { name: 'PCE Price Index', impact: 'high' as const },
  { name: 'ISM Manufacturing', impact: 'medium' as const },
  { name: 'ISM Services', impact: 'medium' as const },
  { name: 'Consumer Confidence', impact: 'medium' as const },
  { name: 'Fed Chair Powell Speaks', impact: 'high' as const },
  { name: 'FOMC Minutes', impact: 'high' as const },
];

/**
 * Fetch events from a public API
 * Note: This is a placeholder - you'd integrate with a real API like Finnhub, Alpha Vantage, etc.
 */
export async function fetchEconomicEvents(
  startDate: Date,
  endDate: Date
): Promise<EconomicEvent[]> {
  try {
    // In production, you would call a real API here
    // For example, Finnhub's economic calendar: https://finnhub.io/docs/api/economic-calendar

    // For now, we'll return empty array - events would be added manually or via API integration
    logger.info('Economic calendar fetch placeholder', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    return [];

  } catch (error) {
    logger.error('Error fetching economic events', error instanceof Error ? error : { message: String(error) });
    return [];
  }
}

/**
 * Get today's economic events from database
 */
export async function getTodayEvents(): Promise<EconomicEvent[]> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('economic_events')
      .select('*')
      .eq('event_date', today)
      .order('event_time', { ascending: true });

    if (error) {
      logger.error('Error fetching today events', { error: error.message });
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      eventDate: row.event_date,
      eventTime: row.event_time,
      eventName: row.event_name,
      country: row.country,
      impact: row.impact,
      previousValue: row.previous_value,
      forecastValue: row.forecast_value,
      actualValue: row.actual_value,
      description: row.description,
    }));

  } catch (error) {
    logger.error('Error in getTodayEvents', error instanceof Error ? error : { message: String(error) });
    return [];
  }
}

/**
 * Get upcoming high-impact events
 */
export async function getUpcomingHighImpactEvents(days = 7): Promise<EconomicEvent[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('economic_events')
      .select('*')
      .gte('event_date', today)
      .lte('event_date', endDate)
      .eq('impact', 'high')
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true });

    if (error) {
      logger.error('Error fetching upcoming high-impact events', { error: error.message });
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      eventDate: row.event_date,
      eventTime: row.event_time,
      eventName: row.event_name,
      country: row.country,
      impact: row.impact,
      previousValue: row.previous_value,
      forecastValue: row.forecast_value,
      actualValue: row.actual_value,
      description: row.description,
    }));

  } catch (error) {
    logger.error('Error in getUpcomingHighImpactEvents', error instanceof Error ? error : { message: String(error) });
    return [];
  }
}

/**
 * Add or update economic events
 */
export async function upsertEconomicEvents(events: EconomicEvent[]): Promise<{ success: boolean; count: number }> {
  try {
    const records = events.map(e => ({
      event_date: e.eventDate,
      event_time: e.eventTime,
      event_name: e.eventName,
      country: e.country || 'US',
      impact: e.impact || 'medium',
      previous_value: e.previousValue,
      forecast_value: e.forecastValue,
      actual_value: e.actualValue,
      description: e.description,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('economic_events')
      .upsert(records, {
        onConflict: 'event_date,event_name',
      });

    if (error) {
      logger.error('Error upserting events', { error: error.message });
      return { success: false, count: 0 };
    }

    return { success: true, count: records.length };

  } catch (error) {
    logger.error('Error in upsertEconomicEvents', error instanceof Error ? error : { message: String(error) });
    return { success: false, count: 0 };
  }
}

/**
 * Check if there are high-impact events today
 */
export async function hasHighImpactEventsToday(): Promise<boolean> {
  const events = await getTodayEvents();
  return events.some(e => e.impact === 'high');
}

/**
 * Get a summary of today's events for the briefing
 */
export async function getEventsSummary(): Promise<{
  hasHighImpact: boolean;
  eventCount: number;
  events: EconomicEvent[];
  warning?: string;
}> {
  const events = await getTodayEvents();
  const hasHighImpact = events.some(e => e.impact === 'high');

  let warning: string | undefined;
  if (hasHighImpact) {
    const highImpactEvents = events.filter(e => e.impact === 'high');
    warning = `High-impact events today: ${highImpactEvents.map(e => e.eventName).join(', ')}. ` +
              `Consider reducing position sizes or waiting for data release.`;
  }

  return {
    hasHighImpact,
    eventCount: events.length,
    events,
    warning,
  };
}
