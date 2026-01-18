import {
  calculateLTPScore,
  getLTPGrade,
  calculateEMA,
  calculateVWAP,
} from '@/lib/ltp-engine';

describe('LTP Engine', () => {
  describe('calculateLTPScore', () => {
    it('should calculate a valid score from component scores', () => {
      const result = calculateLTPScore(80, 70, 90);

      expect(result.level).toBe(80);
      expect(result.trend).toBe(70);
      expect(result.patience).toBe(90);
      expect(result.overall).toBeGreaterThan(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    });

    it('should return higher score for better components', () => {
      const goodResult = calculateLTPScore(90, 90, 90);
      const poorResult = calculateLTPScore(30, 30, 30);

      expect(goodResult.overall).toBeGreaterThan(poorResult.overall);
    });

    it('should clamp scores to 0-100 range', () => {
      const overflowResult = calculateLTPScore(150, 70, 70);
      const underflowResult = calculateLTPScore(-50, 70, 70);

      expect(overflowResult.level).toBe(100);
      expect(underflowResult.level).toBe(0);
    });

    it('should weight level, trend, and patience correctly', () => {
      // Weights: Level 35%, Trend 35%, Patience 30%
      const result = calculateLTPScore(100, 100, 100);
      expect(result.overall).toBe(100);

      const halfResult = calculateLTPScore(50, 50, 50);
      expect(halfResult.overall).toBe(50);
    });
  });

  describe('getLTPGrade', () => {
    // Actual thresholds: A >= 90, B >= 80, C >= 70, D >= 60, F < 60
    it('should return A for score >= 90', () => {
      expect(getLTPGrade(95)).toBe('A');
      expect(getLTPGrade(90)).toBe('A');
    });

    it('should return B for score >= 80', () => {
      expect(getLTPGrade(85)).toBe('B');
      expect(getLTPGrade(80)).toBe('B');
    });

    it('should return C for score >= 70', () => {
      expect(getLTPGrade(75)).toBe('C');
      expect(getLTPGrade(70)).toBe('C');
    });

    it('should return D for score >= 60', () => {
      expect(getLTPGrade(65)).toBe('D');
      expect(getLTPGrade(60)).toBe('D');
    });

    it('should return F for score < 60', () => {
      expect(getLTPGrade(59)).toBe('F');
      expect(getLTPGrade(0)).toBe('F');
    });
  });

  describe('calculateEMA', () => {
    it('should calculate EMA correctly', () => {
      const data = [10, 11, 12, 13, 14, 15, 14, 13, 12, 11];
      const ema = calculateEMA(data, 5);
      expect(ema).toBeGreaterThan(0);
      expect(ema).toBeLessThan(20);
    });

    it('should return last value when data is shorter than period', () => {
      const data = [10, 11, 12];
      const ema = calculateEMA(data, 5);
      expect(ema).toBe(12);
    });

    it('should handle empty array', () => {
      const ema = calculateEMA([], 5);
      expect(ema).toBe(0);
    });

    it('should handle single element', () => {
      const ema = calculateEMA([42], 5);
      expect(ema).toBe(42);
    });
  });

  describe('calculateVWAP', () => {
    it('should calculate VWAP correctly', () => {
      const bars = [
        { o: 98, h: 105, l: 95, c: 100, v: 1000, t: 0 },
        { o: 100, h: 108, l: 98, c: 104, v: 1500, t: 1 },
        { o: 104, h: 106, l: 100, c: 102, v: 1200, t: 2 },
      ];
      const vwap = calculateVWAP(bars);
      expect(vwap).toBeGreaterThan(0);
      expect(vwap).toBeGreaterThan(95);
      expect(vwap).toBeLessThan(110);
    });

    it('should handle empty bars', () => {
      const vwap = calculateVWAP([]);
      expect(vwap).toBe(0);
    });

    it('should handle zero volume', () => {
      const bars = [
        { o: 98, h: 105, l: 95, c: 100, v: 0, t: 0 },
      ];
      const vwap = calculateVWAP(bars);
      expect(vwap).toBe(0);
    });

    it('should weight by volume', () => {
      // Bar with higher volume should have more impact
      const bars = [
        { o: 98, h: 102, l: 98, c: 100, v: 1000, t: 0 }, // TP = 100
        { o: 100, h: 110, l: 100, c: 110, v: 9000, t: 1 }, // TP = ~106.67
      ];
      const vwap = calculateVWAP(bars);
      // Should be closer to 106.67 than 100 due to 9x volume
      expect(vwap).toBeGreaterThan(102);
    });
  });
});
