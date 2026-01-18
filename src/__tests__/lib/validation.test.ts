import {
  createTradeSchema,
  createAlertSchema,
  updateUserSchema,
  chatMessageSchema,
  quoteRequestSchema,
  barsRequestSchema,
  paginationSchema,
  alertTypeSchema,
} from '@/lib/validation';

describe('Validation Schemas', () => {
  describe('createTradeSchema', () => {
    const validBaseTrade = {
      symbol: 'AAPL',
      direction: 'long',
      entry_price: 150.0,
      quantity: 100,
      entry_time: '2024-01-15T10:30:00Z',
    };

    it('should validate a valid trade', () => {
      const validTrade = {
        ...validBaseTrade,
        setup_type: 'breakout',
      };

      const result = createTradeSchema.safeParse(validTrade);
      expect(result.success).toBe(true);
    });

    it('should reject invalid symbol (too short)', () => {
      const invalidTrade = {
        ...validBaseTrade,
        symbol: '',
      };

      const result = createTradeSchema.safeParse(invalidTrade);
      expect(result.success).toBe(false);
    });

    it('should reject invalid direction', () => {
      const invalidTrade = {
        ...validBaseTrade,
        direction: 'sideways', // Invalid
      };

      const result = createTradeSchema.safeParse(invalidTrade);
      expect(result.success).toBe(false);
    });

    it('should reject negative price', () => {
      const invalidTrade = {
        ...validBaseTrade,
        entry_price: -150.0, // Invalid
      };

      const result = createTradeSchema.safeParse(invalidTrade);
      expect(result.success).toBe(false);
    });

    it('should accept optional exit price', () => {
      const tradeWithExit = {
        ...validBaseTrade,
        exit_price: 160.0,
        exit_time: '2024-01-15T14:30:00Z',
      };

      const result = createTradeSchema.safeParse(tradeWithExit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exit_price).toBe(160.0);
      }
    });
  });

  describe('createAlertSchema', () => {
    it('should validate a valid alert', () => {
      const validAlert = {
        symbol: 'SPY',
        direction: 'long',
        alert_type: 'entering',
        message: 'Entering position at key level',
        entry_price: 450.0,
        stop_loss: 445.0,
        targets: [455, 460, 470],
      };

      const result = createAlertSchema.safeParse(validAlert);
      expect(result.success).toBe(true);
    });

    it('should reject invalid alert type', () => {
      const invalidAlert = {
        symbol: 'SPY',
        direction: 'long',
        alert_type: 'invalid_type', // Invalid
        message: 'Test',
      };

      const result = createAlertSchema.safeParse(invalidAlert);
      expect(result.success).toBe(false);
    });

    it('should accept all valid alert types', () => {
      const alertTypes = [
        'loading',
        'entering',
        'adding',
        'take_profit',
        'exiting',
        'stopped_out',
        'update',
      ];

      alertTypes.forEach((alert_type) => {
        const alert = {
          symbol: 'AAPL',
          direction: 'long',
          alert_type,
          message: 'Test message',
        };
        const result = createAlertSchema.safeParse(alert);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('updateUserSchema', () => {
    it('should validate valid user update', () => {
      const validUpdate = {
        display_name: 'John Trader',
        bio: 'Day trader focused on LTP setups',
        trading_style: 'swing',
      };

      const result = updateUserSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should reject display_name over max length', () => {
      const invalidUpdate = {
        display_name: 'x'.repeat(51), // Over 50 char limit
      };

      const result = updateUserSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should accept partial updates', () => {
      const partialUpdate = {
        bio: 'Updated bio only',
      };

      const result = updateUserSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should accept notification preferences', () => {
      const withNotifications = {
        notification_preferences: {
          email_alerts: true,
          push_alerts: false,
          sound_enabled: true,
        },
      };

      const result = updateUserSchema.safeParse(withNotifications);
      expect(result.success).toBe(true);
    });
  });

  describe('chatMessageSchema', () => {
    it('should validate a chat message', () => {
      const validMessage = {
        message: 'What is the LTP framework?',
      };

      const result = chatMessageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const emptyMessage = {
        message: '',
      };

      const result = chatMessageSchema.safeParse(emptyMessage);
      expect(result.success).toBe(false);
    });
  });

  describe('quoteRequestSchema', () => {
    it('should validate a valid quote request', () => {
      const validQuery = {
        symbol: 'AAPL',
      };

      const result = quoteRequestSchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it('should require symbol', () => {
      const invalidQuery = {};

      const result = quoteRequestSchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });
  });

  describe('barsRequestSchema', () => {
    it('should validate a valid bars request', () => {
      const validRequest = {
        symbol: 'AAPL',
        timeframe: '1d',
        limit: 50,
      };

      const result = barsRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should accept valid timeframes', () => {
      const timeframes = ['1m', '2m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

      timeframes.forEach((timeframe) => {
        const request = { symbol: 'AAPL', timeframe };
        const result = barsRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid timeframes', () => {
      const invalidRequest = {
        symbol: 'AAPL',
        timeframe: 'invalid',
      };

      const result = barsRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should validate pagination params', () => {
      const validPagination = {
        page: 2,
        limit: 25,
        sortBy: 'created_at',
        sortOrder: 'desc',
      };

      const result = paginationSchema.safeParse(validPagination);
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const emptyPagination = {};

      const result = paginationSchema.safeParse(emptyPagination);
      expect(result.success).toBe(true);
    });

    it('should accept sort order values', () => {
      const asc = paginationSchema.safeParse({ sortOrder: 'asc' });
      const desc = paginationSchema.safeParse({ sortOrder: 'desc' });

      expect(asc.success).toBe(true);
      expect(desc.success).toBe(true);
    });
  });

  describe('alertTypeSchema', () => {
    it('should accept valid alert types', () => {
      const validTypes = [
        'loading',
        'entering',
        'adding',
        'take_profit',
        'exiting',
        'stopped_out',
        'update',
      ];

      validTypes.forEach((type) => {
        const result = alertTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid alert type', () => {
      const result = alertTypeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });
});
