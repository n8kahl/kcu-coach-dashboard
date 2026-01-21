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
// This is the ONLY chart component for real-time trading
export { ProfessionalChart } from './ProfessionalChart';
export type {
  ProfessionalChartProps,
  ProfessionalChartHandle,
  ChartCandle,
  ChartLevel,
  MassiveLevel,
  GammaLevel as ProfessionalGammaLevel,
} from './ProfessionalChart';
