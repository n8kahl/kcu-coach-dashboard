/**
 * Providers Index
 *
 * Exports all React context providers for the KCU Coach Dashboard.
 */

// Market data provider (general purpose, SSE-based)
export { MarketDataProvider, useMarketDataContext, useOptionalMarketData } from './MarketDataProvider';
export type { MarketStatus } from './MarketDataProvider';

// Market socket provider (Companion Mode, chart-optimized)
export {
  MarketSocketProvider,
  useMarketSocket,
  useChartConnection,
  useOptionalMarketSocket,
} from './MarketSocketProvider';
export type {
  DataMode,
  ConnectionState,
  LatencyMetrics,
  MarketTick,
  MarketSocketContextValue,
} from './MarketSocketProvider';
