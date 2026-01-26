/**
 * Numeric Safety Utilities
 *
 * Prevents NaN and Infinity from appearing in API responses or calculations.
 * All division operations should use these utilities.
 *
 * @see docs/specs/numeric-safety.md
 */

// =============================================================================
// Types
// =============================================================================

export type SafeDivideReason = 'zero_denominator' | 'invalid_input' | 'infinity_result';
export type SafePercentReason = 'zero_base' | 'invalid_input';

export interface SafeDivideResult {
  value: number;
  reason?: SafeDivideReason;
}

export interface SafePercentResult {
  value: number;
  reason?: SafePercentReason;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a finite number (not NaN, not Infinity, not -Infinity)
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Check if a value is a positive finite number (> 0, not NaN, not Infinity)
 */
export function isPositiveFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

/**
 * Check if a value is a non-negative finite number (>= 0, not NaN, not Infinity)
 */
export function isNonNegativeFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

// =============================================================================
// Safe Math Operations
// =============================================================================

/**
 * Safe division that handles zero denominators and invalid inputs.
 *
 * @param numerator - The number to divide
 * @param denominator - The number to divide by
 * @param fallback - Value to return when division is unsafe (default: 0)
 * @returns SafeDivideResult with value and optional reason flag
 *
 * @example
 * safeDivide(10, 2)   // { value: 5 }
 * safeDivide(10, 0)   // { value: 0, reason: 'zero_denominator' }
 * safeDivide(NaN, 2)  // { value: 0, reason: 'invalid_input' }
 */
export function safeDivide(
  numerator: number,
  denominator: number,
  fallback: number = 0
): SafeDivideResult {
  // Check for invalid inputs
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator)) {
    return { value: fallback, reason: 'invalid_input' };
  }

  // Check for zero denominator
  if (denominator === 0) {
    return { value: fallback, reason: 'zero_denominator' };
  }

  const result = numerator / denominator;

  // Check for infinity result (can happen with very small denominators)
  if (!isFiniteNumber(result)) {
    return { value: fallback, reason: 'infinity_result' };
  }

  return { value: result };
}

/**
 * Safe division returning just the value (for simple use cases)
 *
 * @example
 * safeDivideValue(10, 2)   // 5
 * safeDivideValue(10, 0)   // 0
 */
export function safeDivideValue(
  numerator: number,
  denominator: number,
  fallback: number = 0
): number {
  return safeDivide(numerator, denominator, fallback).value;
}

/**
 * Calculate percent change safely.
 *
 * @param current - Current value
 * @param previous - Previous/base value
 * @returns SafePercentResult with percentage change and optional reason
 *
 * @example
 * safePercentChange(110, 100)  // { value: 10 } (10% increase)
 * safePercentChange(90, 100)   // { value: -10 } (10% decrease)
 * safePercentChange(100, 0)    // { value: 0, reason: 'zero_base' }
 */
export function safePercentChange(
  current: number,
  previous: number
): SafePercentResult {
  // Check for invalid inputs
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) {
    return { value: 0, reason: 'invalid_input' };
  }

  // Check for zero base
  if (previous === 0) {
    return { value: 0, reason: 'zero_base' };
  }

  const change = ((current - previous) / previous) * 100;

  // Guard against infinity (shouldn't happen with the above checks, but be safe)
  if (!isFiniteNumber(change)) {
    return { value: 0, reason: 'invalid_input' };
  }

  return { value: change };
}

/**
 * Safe percent change returning just the value
 *
 * @example
 * safePercentChangeValue(110, 100)  // 10
 * safePercentChangeValue(100, 0)    // 0
 */
export function safePercentChangeValue(current: number, previous: number): number {
  return safePercentChange(current, previous).value;
}

/**
 * Clamp a number between min and max, handling edge cases.
 *
 * @param value - The value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value, or min if value is invalid
 *
 * @example
 * clamp(150, 0, 100)  // 100
 * clamp(-10, 0, 100)  // 0
 * clamp(50, 0, 100)   // 50
 * clamp(NaN, 0, 100)  // 0
 */
export function clamp(value: number, min: number, max: number): number {
  if (!isFiniteNumber(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Safe win rate calculation (wins / total * 100)
 *
 * @param wins - Number of wins
 * @param total - Total attempts
 * @returns Win rate percentage (0-100)
 */
export function safeWinRate(wins: number, total: number): number {
  const result = safeDivide(wins, total, 0);
  return result.value * 100;
}

/**
 * Safe profit factor calculation (gross profit / gross loss)
 * Returns 0 when there are no losses (instead of Infinity)
 *
 * @param grossProfit - Total profit from winning trades
 * @param grossLoss - Total loss from losing trades (as positive number)
 * @returns Profit factor, or 0 if no losses
 */
export function safeProfitFactor(grossProfit: number, grossLoss: number): number {
  // If no losses, return 0 (not Infinity)
  // The UI can interpret 0 gross loss as "all winners"
  if (!isPositiveFinite(grossLoss)) {
    return 0;
  }
  return safeDivideValue(grossProfit, grossLoss, 0);
}

/**
 * Safe average calculation
 *
 * @param sum - Sum of values
 * @param count - Number of values
 * @returns Average, or 0 if count is 0
 */
export function safeAverage(sum: number, count: number): number {
  return safeDivideValue(sum, count, 0);
}

/**
 * Safe risk/reward ratio calculation
 *
 * @param reward - Potential reward (distance to target)
 * @param risk - Potential risk (distance to stop)
 * @returns Risk/reward ratio, or 0 if risk is 0
 */
export function safeRiskReward(reward: number, risk: number): number {
  if (!isPositiveFinite(risk)) {
    return 0;
  }
  return safeDivideValue(Math.abs(reward), Math.abs(risk), 0);
}

// =============================================================================
// JSON Safety
// =============================================================================

/**
 * Sanitize a value for JSON serialization.
 * Replaces NaN and Infinity with null.
 *
 * @param value - Any value
 * @returns Safe value for JSON
 */
export function sanitizeForJson<T>(value: T): T {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null as T;
    }
  }
  return value;
}

/**
 * Deep sanitize an object for JSON serialization.
 * Replaces all NaN and Infinity values with null.
 *
 * @param obj - Object to sanitize
 * @returns Sanitized object safe for JSON.stringify
 */
export function sanitizeObjectForJson<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'number') {
    return (Number.isFinite(obj) ? obj : null) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObjectForJson) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObjectForJson(value);
    }
    return result as T;
  }

  return obj;
}
