/**
 * LTP Stream Listener Tests
 *
 * Tests for the event-driven LTP analysis service.
 */

import ltpStreamListener, {
  startListener,
  stopListener,
  isListenerRunning,
  addSymbols,
  removeSymbols,
  getWatchlist,
  getStats,
  analyzeNow,
} from '@/lib/ltp-stream-listener';

// Mock dependencies
jest.mock('@/lib/market-redistributor', () => ({
  getMarketRedistributor: jest.fn(() => ({
    subscribeToUpdates: jest.fn().mockResolvedValue(() => {}),
  })),
}));

jest.mock('@/lib/ltp-detector', () => ({
  analyzeOnDemand: jest.fn(),
}));

jest.mock('@/lib/broadcast', () => ({
  broadcastSetupForming: jest.fn().mockResolvedValue(1),
  broadcastSetupReady: jest.fn().mockResolvedValue(1),
}));

import { getMarketRedistributor } from '@/lib/market-redistributor';
import { analyzeOnDemand } from '@/lib/ltp-detector';
import { broadcastSetupForming, broadcastSetupReady } from '@/lib/broadcast';

const mockGetMarketRedistributor = getMarketRedistributor as jest.MockedFunction<typeof getMarketRedistributor>;
const mockAnalyzeOnDemand = analyzeOnDemand as jest.MockedFunction<typeof analyzeOnDemand>;
const mockBroadcastSetupForming = broadcastSetupForming as jest.MockedFunction<typeof broadcastSetupForming>;
const mockBroadcastSetupReady = broadcastSetupReady as jest.MockedFunction<typeof broadcastSetupReady>;

describe('LTP Stream Listener', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset listener state
    if (isListenerRunning()) {
      stopListener();
    }

    // Setup default mocks
    const mockUnsubscribe = jest.fn();
    mockGetMarketRedistributor.mockReturnValue({
      subscribeToUpdates: jest.fn().mockResolvedValue(mockUnsubscribe),
    } as unknown as ReturnType<typeof getMarketRedistributor>);
  });

  afterEach(() => {
    if (isListenerRunning()) {
      stopListener();
    }
  });

  describe('startListener', () => {
    it('should start the listener', async () => {
      await startListener();

      expect(isListenerRunning()).toBe(true);
    });

    it('should subscribe to watchlist symbols', async () => {
      const mockRedistributor = {
        subscribeToUpdates: jest.fn().mockResolvedValue(() => {}),
      };
      mockGetMarketRedistributor.mockReturnValue(mockRedistributor as unknown as ReturnType<typeof getMarketRedistributor>);

      await startListener(['SPY', 'QQQ']);

      expect(mockRedistributor.subscribeToUpdates).toHaveBeenCalledWith(
        ['SPY', 'QQQ'],
        expect.any(Function)
      );
    });

    it('should not start if already running', async () => {
      await startListener();
      const firstRedistributor = getMarketRedistributor();

      jest.clearAllMocks();
      await startListener(); // Should be no-op

      // getMarketRedistributor should not be called again
      expect(mockGetMarketRedistributor).not.toHaveBeenCalled();
    });
  });

  describe('stopListener', () => {
    it('should stop the listener', async () => {
      await startListener();
      expect(isListenerRunning()).toBe(true);

      stopListener();
      expect(isListenerRunning()).toBe(false);
    });

    it('should call unsubscribe', async () => {
      const mockUnsubscribe = jest.fn();
      mockGetMarketRedistributor.mockReturnValue({
        subscribeToUpdates: jest.fn().mockResolvedValue(mockUnsubscribe),
      } as unknown as ReturnType<typeof getMarketRedistributor>);

      await startListener();
      stopListener();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('watchlist management', () => {
    it('should use default watchlist', () => {
      const watchlist = getWatchlist();
      expect(watchlist).toContain('SPY');
      expect(watchlist).toContain('QQQ');
    });

    it('should add symbols to watchlist', async () => {
      await addSymbols(['PTON', 'ROKU']);
      const watchlist = getWatchlist();
      expect(watchlist).toContain('PTON');
      expect(watchlist).toContain('ROKU');
    });

    it('should normalize symbols to uppercase', async () => {
      await addSymbols(['pton', 'roku']);
      const watchlist = getWatchlist();
      expect(watchlist).toContain('PTON');
      expect(watchlist).toContain('ROKU');
    });

    it('should remove symbols from watchlist', () => {
      removeSymbols(['SPY', 'QQQ']);
      const watchlist = getWatchlist();
      expect(watchlist).not.toContain('SPY');
      expect(watchlist).not.toContain('QQQ');
    });
  });

  describe('getStats', () => {
    it('should return listener statistics', async () => {
      await startListener();
      const stats = getStats();

      expect(stats).toEqual({
        isRunning: true,
        watchlistSize: expect.any(Number),
        barCount: 0,
        analysisCount: 0,
        setupCount: 0,
        pendingAnalyses: 0,
      });
    });
  });

  describe('analyzeNow', () => {
    it('should trigger analysis for a symbol', async () => {
      mockAnalyzeOnDemand.mockResolvedValue({
        symbol: 'TEST',
        direction: 'bullish',
        setup_stage: 'forming',
        confluence_score: 75,
        level_score: 80,
        trend_score: 70,
        patience_score: 75,
        mtf_score: 70,
        primary_level_type: 'vwap',
        primary_level_price: 100,
        patience_candles: 2,
        suggested_entry: 100.5,
        suggested_stop: 99.5,
        target_1: 101.5,
        target_2: 102.5,
        target_3: 103.5,
        risk_reward: 2.0,
        coach_note: 'Test setup',
      });

      await analyzeNow('TEST');

      expect(mockAnalyzeOnDemand).toHaveBeenCalledWith('TEST');
      expect(mockBroadcastSetupReady).toHaveBeenCalled();
    });

    it('should broadcast setup_forming for scores below ready threshold', async () => {
      mockAnalyzeOnDemand.mockResolvedValue({
        symbol: 'TEST',
        direction: 'bullish',
        setup_stage: 'forming',
        confluence_score: 55, // Below ready threshold of 70
        level_score: 60,
        trend_score: 50,
        patience_score: 55,
        mtf_score: 50,
        primary_level_type: 'vwap',
        primary_level_price: 100,
        patience_candles: 1,
        suggested_entry: null,
        suggested_stop: null,
        target_1: null,
        target_2: null,
        target_3: null,
        risk_reward: null,
        coach_note: 'Forming setup',
      });

      await analyzeNow('TEST');

      expect(mockBroadcastSetupForming).toHaveBeenCalled();
      expect(mockBroadcastSetupReady).not.toHaveBeenCalled();
    });

    it('should not broadcast for low confluence scores', async () => {
      mockAnalyzeOnDemand.mockResolvedValue({
        symbol: 'TEST',
        direction: 'bullish',
        setup_stage: 'forming',
        confluence_score: 30, // Below min threshold of 50
        level_score: 30,
        trend_score: 30,
        patience_score: 30,
        mtf_score: 30,
        primary_level_type: null,
        primary_level_price: null,
        patience_candles: 0,
        suggested_entry: null,
        suggested_stop: null,
        target_1: null,
        target_2: null,
        target_3: null,
        risk_reward: null,
        coach_note: 'No setup',
      });

      await analyzeNow('TEST');

      expect(mockBroadcastSetupForming).not.toHaveBeenCalled();
      expect(mockBroadcastSetupReady).not.toHaveBeenCalled();
    });

    it('should handle null analysis result', async () => {
      mockAnalyzeOnDemand.mockResolvedValue(null);

      await analyzeNow('INVALID');

      expect(mockBroadcastSetupForming).not.toHaveBeenCalled();
      expect(mockBroadcastSetupReady).not.toHaveBeenCalled();
    });
  });

  describe('default export', () => {
    it('should export all methods', () => {
      expect(ltpStreamListener.start).toBe(startListener);
      expect(ltpStreamListener.stop).toBe(stopListener);
      expect(ltpStreamListener.isRunning).toBe(isListenerRunning);
      expect(ltpStreamListener.addSymbols).toBe(addSymbols);
      expect(ltpStreamListener.removeSymbols).toBe(removeSymbols);
      expect(ltpStreamListener.getWatchlist).toBe(getWatchlist);
      expect(ltpStreamListener.getStats).toBe(getStats);
      expect(ltpStreamListener.analyzeNow).toBe(analyzeNow);
    });
  });
});
