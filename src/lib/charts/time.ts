/**
 * Chart Time Bucketing Utilities
 *
 * Pure functions for normalizing timestamps and computing candle bucket boundaries.
 * These are the "unit-tested truth" for time bucketing across all chart components.
 *
 * Key concepts:
 * - Epoch seconds: Unix timestamp in seconds (10 digits, e.g., 1706198400)
 * - Epoch milliseconds: Unix timestamp in milliseconds (13 digits, e.g., 1706198400000)
 * - Bucket: A time interval that candles are grouped into (e.g., 2m, 5m, 1h)
 */

/**
 * Threshold to distinguish seconds from milliseconds.
 * Timestamps before year 2001 in ms (978307200000) are assumed to be seconds.
 * Timestamps after year 2001 in seconds (978307200) would be in the 1970s in ms.
 */
const MS_VS_SECONDS_THRESHOLD = 1_000_000_000_000;

/**
 * Normalize a timestamp to epoch seconds.
 *
 * Handles both millisecond and second inputs by detecting the magnitude.
 * - If ts >= 1_000_000_000_000 (13+ digits), treat as milliseconds
 * - If ts < 1_000_000_000_000 (10 digits), treat as seconds
 *
 * @param ts - Timestamp in either milliseconds or seconds
 * @returns Timestamp in epoch seconds (floored to integer)
 *
 * @example
 * toEpochSeconds(1706198400000) // ms input -> 1706198400
 * toEpochSeconds(1706198400)    // seconds input -> 1706198400
 * toEpochSeconds(1706198400123) // ms with fractional -> 1706198400
 */
export function toEpochSeconds(ts: number): number {
  if (ts >= MS_VS_SECONDS_THRESHOLD) {
    // Input is in milliseconds, convert to seconds
    return Math.floor(ts / 1000);
  }
  // Input is already in seconds
  return Math.floor(ts);
}

/**
 * Get the start of the bucket that contains the given timestamp.
 *
 * Buckets are aligned to Unix epoch (1970-01-01 00:00:00 UTC).
 * For example, with a 5-minute (300s) timeframe:
 * - 12:00:00 -> 12:00:00 (exact boundary)
 * - 12:02:30 -> 12:00:00
 * - 12:04:59 -> 12:00:00
 * - 12:05:00 -> 12:05:00 (next bucket)
 *
 * @param epochSeconds - Timestamp in epoch seconds
 * @param timeframeSeconds - Bucket size in seconds (e.g., 120 for 2m, 300 for 5m)
 * @returns Start of the bucket in epoch seconds
 *
 * @example
 * // 2-minute buckets (120 seconds)
 * getBucketStart(1706198520, 120) // 12:02:00 -> 12:02:00
 * getBucketStart(1706198550, 120) // 12:02:30 -> 12:02:00
 * getBucketStart(1706198640, 120) // 12:04:00 -> 12:04:00
 *
 * @example
 * // 5-minute buckets (300 seconds)
 * getBucketStart(1706198400, 300) // 12:00:00 -> 12:00:00
 * getBucketStart(1706198500, 300) // 12:01:40 -> 12:00:00
 * getBucketStart(1706198700, 300) // 12:05:00 -> 12:05:00
 */
export function getBucketStart(epochSeconds: number, timeframeSeconds: number): number {
  if (timeframeSeconds <= 0) {
    throw new Error('timeframeSeconds must be positive');
  }
  // Floor division to find bucket start
  return Math.floor(epochSeconds / timeframeSeconds) * timeframeSeconds;
}

/**
 * Common timeframe constants in seconds.
 */
export const TIMEFRAME_SECONDS = {
  '1m': 60,
  '2m': 120,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
} as const;

export type TimeframeKey = keyof typeof TIMEFRAME_SECONDS;

/**
 * Get bucket start for a named timeframe.
 *
 * @param epochSeconds - Timestamp in epoch seconds
 * @param timeframe - Named timeframe (e.g., '2m', '5m', '1h')
 * @returns Start of the bucket in epoch seconds
 *
 * @example
 * getBucketStartForTimeframe(1706198550, '5m') // -> bucket start
 */
export function getBucketStartForTimeframe(
  epochSeconds: number,
  timeframe: TimeframeKey
): number {
  return getBucketStart(epochSeconds, TIMEFRAME_SECONDS[timeframe]);
}
