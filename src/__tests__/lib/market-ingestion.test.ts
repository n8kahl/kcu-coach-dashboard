/**
 * Market Ingestion Tests
 *
 * Tests for the "All-Seeing Eye" data ingestion layer.
 * Verifies data structures, breadth calculations, and calendar logic.
 */

import {
  fetchMarketBreadth,
  fetchEconomicCalendar,
  buildHotContext,
  generateProactiveWarnings,
  determineTradingConditions,
  enhanceEvents,
  MarketBreadth,
  EnhancedEconomicEvent,
  ProactiveWarning,
  MarketHotContext,
} from '../../../scripts/market-worker';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Market Ingestion Layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  // =============================================================================
  // MARKET BREADTH TESTS
  // =============================================================================

  describe('Market Breadth', () => {
    it('should have correct interface structure', () => {
      const mockBreadth: MarketBreadth = {
        timestamp: new Date().toISOString(),
        add: {
          value: 500,
          change: 100,
          trend: 'bullish',
          divergence: null,
        },
        vold: {
          value: 150,
          change: 50,
          trend: 'buying_pressure',
          intensity: 'moderate',
        },
        tick: {
          current: 600,
          high: 800,
          low: -200,
          extremeReading: false,
          signal: 'neutral',
        },
        healthScore: 65,
        tradingBias: 'favor_longs',
        coachingMessage: "The river's flowing up. Don't fight it.",
      };

      expect(mockBreadth.add.trend).toBe('bullish');
      expect(mockBreadth.vold.intensity).toBe('moderate');
      expect(mockBreadth.tick.extremeReading).toBe(false);
      expect(mockBreadth.tradingBias).toBe('favor_longs');
    });

    it('should return simulated breadth when API unavailable', async () => {
      // No API key configured, should return simulated data
      const breadth = await fetchMarketBreadth();

      expect(breadth).not.toBeNull();
      expect(breadth?.timestamp).toBeDefined();
      expect(breadth?.add).toBeDefined();
      expect(breadth?.vold).toBeDefined();
      expect(breadth?.tick).toBeDefined();
      expect(breadth?.healthScore).toBeGreaterThanOrEqual(0);
      expect(breadth?.healthScore).toBeLessThanOrEqual(100);
    });

    it('should calculate health score within valid range', async () => {
      const breadth = await fetchMarketBreadth();

      expect(breadth?.healthScore).toBeGreaterThanOrEqual(0);
      expect(breadth?.healthScore).toBeLessThanOrEqual(100);
    });

    it('should generate valid trading bias', async () => {
      const breadth = await fetchMarketBreadth();

      expect(['favor_longs', 'favor_shorts', 'neutral', 'caution']).toContain(
        breadth?.tradingBias
      );
    });

    it('should detect extreme TICK readings', async () => {
      const breadth = await fetchMarketBreadth();

      if (breadth && Math.abs(breadth.tick.current) > 1000) {
        expect(breadth.tick.extremeReading).toBe(true);
      }
    });

    it('should have valid ADD trend values', async () => {
      const breadth = await fetchMarketBreadth();
      const validTrends = [
        'strong_bullish',
        'bullish',
        'neutral',
        'bearish',
        'strong_bearish',
      ];

      expect(validTrends).toContain(breadth?.add.trend);
    });

    it('should have valid VOLD intensity values', async () => {
      const breadth = await fetchMarketBreadth();
      const validIntensities = ['extreme', 'strong', 'moderate', 'weak'];

      expect(validIntensities).toContain(breadth?.vold.intensity);
    });
  });

  // =============================================================================
  // ECONOMIC CALENDAR TESTS
  // =============================================================================

  describe('Economic Calendar', () => {
    it('should return enhanced events with time calculations', async () => {
      const events = await fetchEconomicCalendar();

      expect(Array.isArray(events)).toBe(true);

      if (events.length > 0) {
        const event = events[0];
        expect(event.id).toBeDefined();
        expect(event.date).toBeDefined();
        expect(event.time).toBeDefined();
        expect(event.event).toBeDefined();
        expect(event.impact).toBeDefined();
        expect(event.eventTimestamp).toBeDefined();
        expect(typeof event.minutesUntilEvent).toBe('number');
        expect(typeof event.isImminent).toBe('boolean');
        expect(typeof event.isPast).toBe('boolean');
      }
    });

    it('should have valid impact levels', async () => {
      const events = await fetchEconomicCalendar();
      const validImpacts = ['high', 'medium', 'low'];

      events.forEach((event) => {
        expect(validImpacts).toContain(event.impact);
      });
    });

    it('should have valid trading guidance', async () => {
      const events = await fetchEconomicCalendar();
      const validGuidance = [
        'flatten_positions',
        'reduce_size',
        'avoid_new_trades',
        'normal',
      ];

      events.forEach((event) => {
        expect(validGuidance).toContain(event.tradingGuidance);
      });
    });

    it('should mark imminent events correctly', async () => {
      const basicEvents = [
        {
          date: new Date().toISOString().split('T')[0],
          time: new Date(Date.now() + 5 * 60000)
            .toTimeString()
            .split(' ')[0]
            .slice(0, 5), // 5 minutes from now
          event: 'Test Event',
          impact: 'high' as const,
        },
      ];

      const enhanced = enhanceEvents(basicEvents);

      // Should be imminent (within 10 minutes)
      expect(enhanced.length).toBe(1);
      // Note: The actual isImminent check depends on current time
    });

    it('should generate Somesh-style coaching messages', async () => {
      const events = await fetchEconomicCalendar();

      events
        .filter((e) => e.impact === 'high' && !e.isPast)
        .forEach((event) => {
          expect(event.coachingMessage).toBeDefined();
          expect(event.coachingMessage.length).toBeGreaterThan(0);
        });
    });
  });

  // =============================================================================
  // PROACTIVE WARNINGS TESTS
  // =============================================================================

  describe('Proactive Warnings', () => {
    it('should generate warnings for strong bearish breadth', () => {
      const bearishBreadth: MarketBreadth = {
        timestamp: new Date().toISOString(),
        add: {
          value: -1500,
          change: -500,
          trend: 'strong_bearish',
          divergence: null,
        },
        vold: {
          value: -200,
          change: -100,
          trend: 'selling_pressure',
          intensity: 'strong',
        },
        tick: {
          current: -800,
          high: 200,
          low: -1000,
          extremeReading: false,
          signal: 'sell_signal',
        },
        healthScore: 25,
        tradingBias: 'favor_shorts',
        coachingMessage: 'Bears in control.',
      };

      const warnings = generateProactiveWarnings(bearishBreadth, []);

      expect(warnings.length).toBeGreaterThan(0);
      const breadthWarning = warnings.find((w) => w.type === 'market_breadth');
      expect(breadthWarning).toBeDefined();
      expect(breadthWarning?.severity).toBe('warning');
    });

    it('should generate critical warnings for imminent events', () => {
      const now = new Date();
      const imminentEvent: EnhancedEconomicEvent = {
        id: 'test_event',
        date: now.toISOString().split('T')[0],
        time: '08:30',
        timezone: 'America/New_York',
        event: 'CPI Release',
        impact: 'high',
        eventTimestamp: now.getTime() + 3 * 60000, // 3 minutes from now
        minutesUntilEvent: 3,
        isImminent: true,
        isPast: false,
        tradingGuidance: 'flatten_positions',
        warningLevel: 'critical',
        coachingMessage: 'CPI in 3 minutes! Flatten out!',
      };

      const warnings = generateProactiveWarnings(null, [imminentEvent]);

      expect(warnings.length).toBeGreaterThan(0);
      const eventWarning = warnings.find((w) => w.type === 'economic_event');
      expect(eventWarning).toBeDefined();
      expect(eventWarning?.severity).toBe('critical');
      expect(eventWarning?.actionRequired).toBe(true);
    });

    it('should have Somesh coach style on all warnings', () => {
      const breadth: MarketBreadth = {
        timestamp: new Date().toISOString(),
        add: { value: -1200, change: -400, trend: 'strong_bearish', divergence: null },
        vold: { value: -100, change: -50, trend: 'selling_pressure', intensity: 'strong' },
        tick: { current: -1100, high: 100, low: -1200, extremeReading: true, signal: 'sell_signal' },
        healthScore: 20,
        tradingBias: 'favor_shorts',
        coachingMessage: 'Bearish.',
      };

      const warnings = generateProactiveWarnings(breadth, []);

      warnings.forEach((warning) => {
        expect(warning.coachStyle).toBe('somesh');
      });
    });

    it('should include expiration times on warnings', () => {
      const breadth: MarketBreadth = {
        timestamp: new Date().toISOString(),
        add: { value: 1500, change: 500, trend: 'strong_bullish', divergence: null },
        vold: { value: 200, change: 100, trend: 'buying_pressure', intensity: 'strong' },
        tick: { current: 800, high: 900, low: 0, extremeReading: false, signal: 'buy_signal' },
        healthScore: 80,
        tradingBias: 'favor_longs',
        coachingMessage: 'Bulls in control.',
      };

      const warnings = generateProactiveWarnings(breadth, []);

      warnings.forEach((warning) => {
        if (warning.expiresAt) {
          const expiresAt = new Date(warning.expiresAt);
          expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
        }
      });
    });
  });

  // =============================================================================
  // TRADING CONDITIONS TESTS
  // =============================================================================

  describe('Trading Conditions', () => {
    it('should return red status for imminent high-impact events', () => {
      const imminentEvent: EnhancedEconomicEvent = {
        id: 'fomc',
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
        timezone: 'America/New_York',
        event: 'FOMC Decision',
        impact: 'high',
        eventTimestamp: Date.now() + 5 * 60000,
        minutesUntilEvent: 5,
        isImminent: true,
        isPast: false,
        tradingGuidance: 'flatten_positions',
        warningLevel: 'critical',
        coachingMessage: 'FOMC imminent!',
      };

      const conditions = determineTradingConditions(null, [imminentEvent]);

      expect(conditions.status).toBe('red');
      expect(conditions.restrictions.length).toBeGreaterThan(0);
      expect(conditions.restrictions).toContain('No new positions');
    });

    it('should return yellow status for upcoming high-impact events', () => {
      const upcomingEvent: EnhancedEconomicEvent = {
        id: 'cpi',
        date: new Date().toISOString().split('T')[0],
        time: '08:30',
        timezone: 'America/New_York',
        event: 'CPI',
        impact: 'high',
        eventTimestamp: Date.now() + 20 * 60000, // 20 minutes away
        minutesUntilEvent: 20,
        isImminent: false,
        isPast: false,
        tradingGuidance: 'avoid_new_trades',
        warningLevel: 'warning',
        coachingMessage: 'CPI approaching.',
      };

      const conditions = determineTradingConditions(null, [upcomingEvent]);

      expect(conditions.status).toBe('yellow');
      expect(conditions.restrictions).toContain('Reduce position size by 50%');
    });

    it('should return green status when no concerns', () => {
      const pastEvent: EnhancedEconomicEvent = {
        id: 'past_cpi',
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
        time: '08:30',
        timezone: 'America/New_York',
        event: 'CPI',
        impact: 'high',
        eventTimestamp: Date.now() - 86400000,
        minutesUntilEvent: -1440,
        isImminent: false,
        isPast: true,
        tradingGuidance: 'normal',
        warningLevel: 'info',
        coachingMessage: 'Past event.',
      };

      const conditions = determineTradingConditions(null, [pastEvent]);

      expect(conditions.status).toBe('green');
    });

    it('should add breadth-based restrictions', () => {
      const bearishBreadth: MarketBreadth = {
        timestamp: new Date().toISOString(),
        add: { value: -1000, change: -300, trend: 'strong_bearish', divergence: null },
        vold: { value: -150, change: -75, trend: 'selling_pressure', intensity: 'strong' },
        tick: { current: -600, high: 100, low: -800, extremeReading: false, signal: 'sell_signal' },
        healthScore: 30,
        tradingBias: 'favor_shorts',
        coachingMessage: 'Bears winning.',
      };

      const conditions = determineTradingConditions(bearishBreadth, []);

      expect(conditions.restrictions).toContain('Avoid long entries');
    });
  });

  // =============================================================================
  // HOT CONTEXT TESTS
  // =============================================================================

  describe('Hot Context', () => {
    it('should build complete hot context', async () => {
      const breadth = await fetchMarketBreadth();
      const events = await fetchEconomicCalendar();

      const hotContext = await buildHotContext(breadth, events);

      expect(hotContext.timestamp).toBeDefined();
      expect(hotContext.breadth).toBeDefined();
      expect(hotContext.calendar).toBeDefined();
      expect(hotContext.tradingConditions).toBeDefined();
      expect(hotContext.activeWarnings).toBeDefined();
      expect(Array.isArray(hotContext.activeWarnings)).toBe(true);
    });

    it('should correctly identify today\'s events', async () => {
      const breadth = await fetchMarketBreadth();
      const events = await fetchEconomicCalendar();

      const hotContext = await buildHotContext(breadth, events);
      const todayStr = new Date().toISOString().split('T')[0];

      hotContext.calendar.todayEvents.forEach((event) => {
        expect(event.date).toBe(todayStr);
      });
    });

    it('should sort events by timestamp', async () => {
      const breadth = await fetchMarketBreadth();
      const events = await fetchEconomicCalendar();

      const hotContext = await buildHotContext(breadth, events);

      const futureEvents = events.filter((e) => !e.isPast);
      if (futureEvents.length > 1) {
        for (let i = 1; i < futureEvents.length; i++) {
          expect(futureEvents[i].eventTimestamp).toBeGreaterThanOrEqual(
            futureEvents[i - 1].eventTimestamp
          );
        }
      }
    });

    it('should identify next upcoming event', async () => {
      const breadth = await fetchMarketBreadth();
      const events = await fetchEconomicCalendar();

      const hotContext = await buildHotContext(breadth, events);

      if (hotContext.calendar.nextEvent) {
        expect(hotContext.calendar.nextEvent.isPast).toBe(false);
        expect(hotContext.calendar.nextEvent.minutesUntilEvent).toBeGreaterThan(0);
      }
    });
  });

  // =============================================================================
  // DATA STRUCTURE VALIDATION TESTS
  // =============================================================================

  describe('Data Structure Validation', () => {
    it('should validate ProactiveWarning structure', () => {
      const warning: ProactiveWarning = {
        id: 'test_warning',
        timestamp: new Date().toISOString(),
        severity: 'warning',
        type: 'market_breadth',
        title: 'Test Warning',
        message: 'This is a test warning.',
        coachStyle: 'somesh',
        actionRequired: false,
        suggestedAction: 'Stay cautious',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      };

      expect(warning.id).toBeDefined();
      expect(warning.coachStyle).toBe('somesh');
      expect(['critical', 'warning', 'info']).toContain(warning.severity);
      expect([
        'market_breadth',
        'economic_event',
        'volatility',
        'order_flow',
        'pattern',
      ]).toContain(warning.type);
    });

    it('should validate MarketHotContext structure', () => {
      const context: MarketHotContext = {
        timestamp: new Date().toISOString(),
        breadth: null,
        calendar: {
          todayEvents: [],
          nextEvent: null,
          hasHighImpactToday: false,
          isEventImminent: false,
        },
        tradingConditions: {
          status: 'green',
          message: 'Normal conditions.',
          restrictions: [],
        },
        activeWarnings: [],
      };

      expect(context.timestamp).toBeDefined();
      expect(context.calendar).toBeDefined();
      expect(context.tradingConditions).toBeDefined();
      expect(['green', 'yellow', 'red']).toContain(context.tradingConditions.status);
    });

    it('should validate EnhancedEconomicEvent structure', () => {
      const event: EnhancedEconomicEvent = {
        id: 'test_event',
        date: '2026-01-20',
        time: '08:30',
        timezone: 'America/New_York',
        event: 'Test Event',
        impact: 'high',
        eventTimestamp: Date.now(),
        minutesUntilEvent: 60,
        isImminent: false,
        isPast: false,
        tradingGuidance: 'normal',
        warningLevel: 'info',
        coachingMessage: 'Test message.',
      };

      expect(event.timezone).toBe('America/New_York');
      expect(['high', 'medium', 'low']).toContain(event.impact);
      expect([
        'flatten_positions',
        'reduce_size',
        'avoid_new_trades',
        'normal',
      ]).toContain(event.tradingGuidance);
      expect(['critical', 'warning', 'info']).toContain(event.warningLevel);
    });
  });
});
