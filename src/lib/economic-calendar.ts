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
 * Fetch events from Finnhub API
 * Requires FINNHUB_API_KEY environment variable
 */
export async function fetchEconomicEvents(
  startDate: Date,
  endDate: Date
): Promise<EconomicEvent[]> {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      logger.warn('FINNHUB_API_KEY not configured, using fallback data');
      return getFallbackEvents(startDate, endDate);
    }

    const fromDate = startDate.toISOString().split('T')[0];
    const toDate = endDate.toISOString().split('T')[0];

    const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromDate}&to=${toDate}&token=${apiKey}`;

    const res = await fetch(url);

    if (!res.ok) {
      logger.error('Finnhub API error', { status: res.status });
      return getFallbackEvents(startDate, endDate);
    }

    const data = await res.json();

    if (!data.economicCalendar || !Array.isArray(data.economicCalendar)) {
      logger.warn('No economic calendar data returned');
      return [];
    }

    // Filter to US events and map to our format
    const events: EconomicEvent[] = data.economicCalendar
      .filter((e: FinnhubEvent) => e.country === 'US')
      .map((e: FinnhubEvent) => ({
        eventDate: e.date,
        eventTime: e.time || undefined,
        eventName: e.event,
        country: e.country,
        impact: mapImpact(e.impact, e.event),
        previousValue: e.prev?.toString(),
        forecastValue: e.estimate?.toString(),
        actualValue: e.actual?.toString(),
        description: e.unit ? `Unit: ${e.unit}` : undefined,
      }));

    logger.info('Fetched economic events from Finnhub', { count: events.length });
    return events;

  } catch (error) {
    logger.error('Error fetching economic events', error instanceof Error ? error : { message: String(error) });
    return getFallbackEvents(startDate, endDate);
  }
}

// Finnhub event structure
interface FinnhubEvent {
  date: string;
  time?: string;
  event: string;
  country: string;
  impact: string;
  prev?: number;
  estimate?: number;
  actual?: number;
  unit?: string;
}

/**
 * Map Finnhub impact to our impact levels
 */
function mapImpact(finnhubImpact: string, eventName: string): 'low' | 'medium' | 'high' {
  // Finnhub uses 'low', 'medium', 'high' but sometimes the field is missing
  if (finnhubImpact === 'high') return 'high';
  if (finnhubImpact === 'medium') return 'medium';
  if (finnhubImpact === 'low') return 'low';

  // Fallback: check if it's a key event
  const highImpactKeywords = ['FOMC', 'CPI', 'NFP', 'Non-Farm', 'GDP', 'PCE', 'Fed Chair', 'Interest Rate'];
  const mediumImpactKeywords = ['Retail Sales', 'Jobless Claims', 'ISM', 'Consumer Confidence'];

  const upperEvent = eventName.toUpperCase();
  if (highImpactKeywords.some(k => upperEvent.includes(k.toUpperCase()))) return 'high';
  if (mediumImpactKeywords.some(k => upperEvent.includes(k.toUpperCase()))) return 'medium';

  return 'low';
}

/**
 * Fallback events when API is unavailable
 * Returns recurring high-impact events based on typical schedule
 */
function getFallbackEvents(startDate: Date, endDate: Date): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const dayOfMonth = current.getDate();
    const dateStr = current.toISOString().split('T')[0];

    // Weekly Initial Jobless Claims (Thursdays)
    if (dayOfWeek === 4) {
      events.push({
        eventDate: dateStr,
        eventTime: '08:30',
        eventName: 'Initial Jobless Claims',
        country: 'US',
        impact: 'medium',
      });
    }

    // First Friday - Non-Farm Payrolls
    if (dayOfWeek === 5 && dayOfMonth <= 7) {
      events.push({
        eventDate: dateStr,
        eventTime: '08:30',
        eventName: 'Non-Farm Payrolls',
        country: 'US',
        impact: 'high',
      });
      events.push({
        eventDate: dateStr,
        eventTime: '08:30',
        eventName: 'Unemployment Rate',
        country: 'US',
        impact: 'high',
      });
    }

    // Mid-month CPI (usually around 13th)
    if (dayOfMonth >= 10 && dayOfMonth <= 15 && dayOfWeek !== 0 && dayOfWeek !== 6) {
      if (dayOfMonth === 13) {
        events.push({
          eventDate: dateStr,
          eventTime: '08:30',
          eventName: 'CPI (Consumer Price Index)',
          country: 'US',
          impact: 'high',
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return events;
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
 * Sync economic events for the next N days
 * Fetches from API (or fallback) and stores in database
 */
export async function syncEconomicEvents(days = 14): Promise<{ success: boolean; count: number }> {
  try {
    const startDate = new Date();
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    logger.info('Syncing economic events', {
      from: startDate.toISOString().split('T')[0],
      to: endDate.toISOString().split('T')[0],
    });

    const events = await fetchEconomicEvents(startDate, endDate);

    if (events.length === 0) {
      logger.info('No events to sync');
      return { success: true, count: 0 };
    }

    const result = await upsertEconomicEvents(events);

    logger.info('Economic events synced', { count: result.count });
    return result;

  } catch (error) {
    logger.error('Error syncing economic events', error instanceof Error ? error : { message: String(error) });
    return { success: false, count: 0 };
  }
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
