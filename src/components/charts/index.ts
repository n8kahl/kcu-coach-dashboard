/**
 * Chart Components Index
 *
 * Exports all chart-related components for the KCU Coach Dashboard.
 */

// KCU Unified Chart - Somesh's Indicators, Gamma Levels, FVG, Patience Candles
export { KCUChart } from './KCUChart';
export type {
  KCUChartProps,
  Candle,
  Level,
  GammaLevel,
  FVGZone,
} from './KCUChart';

// Professional Chart - High-performance canvas-based chart for Companion Mode
export { ProfessionalChart } from './ProfessionalChart';
export type {
  ProfessionalChartProps,
  ChartCandle,
  ChartLevel,
  GammaLevel as ProfessionalGammaLevel,
} from './ProfessionalChart';

// TradingView Widgets - External embeds for market overview
export {
  TradingViewWidget,
  MiniChartWidget,
  MarketOverviewWidget,
  TickerTapeWidget,
} from './trading-view-widget';
