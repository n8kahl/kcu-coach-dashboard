/**
 * Data Integrity Module
 *
 * Ensures data mode isolation between Practice and Companion modes.
 * CRITICAL: Prevents simulated/practice data from bleeding into live companion mode.
 *
 * Architecture:
 * - PRACTICE mode: Can access scenarios table, simulated data, historical replays
 * - COMPANION mode: MUST use live market data APIs only, NO scenario access
 */

// =============================================================================
// Types
// =============================================================================

export type DataMode = 'PRACTICE' | 'COMPANION';

export interface DataSourceConfig {
  mode: DataMode;
  allowScenarios: boolean;
  allowSimulatedData: boolean;
  requireLiveAPI: boolean;
}

export class DataIntegrityError extends Error {
  constructor(
    message: string,
    public readonly mode: DataMode,
    public readonly attemptedSource: string
  ) {
    super(message);
    this.name = 'DataIntegrityError';
  }
}

// =============================================================================
// Mode Configuration
// =============================================================================

const MODE_CONFIG: Record<DataMode, DataSourceConfig> = {
  PRACTICE: {
    mode: 'PRACTICE',
    allowScenarios: true,
    allowSimulatedData: true,
    requireLiveAPI: false,
  },
  COMPANION: {
    mode: 'COMPANION',
    allowScenarios: false,
    allowSimulatedData: false,
    requireLiveAPI: true,
  },
};

// =============================================================================
// Mode Guard Functions
// =============================================================================

/**
 * Get the configuration for a data mode
 */
export function getModeConfig(mode: DataMode): DataSourceConfig {
  return MODE_CONFIG[mode];
}

/**
 * Assert that scenario access is allowed for the current mode.
 * Throws DataIntegrityError if attempting to access scenarios in COMPANION mode.
 *
 * @example
 * ```ts
 * assertScenarioAccess('COMPANION'); // throws!
 * assertScenarioAccess('PRACTICE');  // ok
 * ```
 */
export function assertScenarioAccess(mode: DataMode): void {
  const config = getModeConfig(mode);
  if (!config.allowScenarios) {
    throw new DataIntegrityError(
      `CRITICAL: Cannot access scenarios table in ${mode} mode. ` +
        `This would leak simulated data into live trading view.`,
      mode,
      'scenarios'
    );
  }
}

/**
 * Assert that simulated data is allowed for the current mode.
 * Throws DataIntegrityError if attempting to use simulated data in COMPANION mode.
 */
export function assertSimulatedDataAccess(mode: DataMode): void {
  const config = getModeConfig(mode);
  if (!config.allowSimulatedData) {
    throw new DataIntegrityError(
      `CRITICAL: Cannot use simulated data in ${mode} mode. ` +
        `Companion mode requires live market data only.`,
      mode,
      'simulated_data'
    );
  }
}

/**
 * Assert that the data source is valid for the current mode.
 * Use this before any data fetch operation.
 */
export function assertValidDataSource(
  mode: DataMode,
  source: 'api' | 'scenarios' | 'simulated' | 'cache' | 'redis'
): void {
  const config = getModeConfig(mode);

  if (source === 'scenarios' && !config.allowScenarios) {
    throw new DataIntegrityError(
      `Cannot access scenarios in ${mode} mode`,
      mode,
      source
    );
  }

  if (source === 'simulated' && !config.allowSimulatedData) {
    throw new DataIntegrityError(
      `Cannot use simulated data in ${mode} mode`,
      mode,
      source
    );
  }
}

/**
 * Check if scenarios access is allowed (non-throwing version)
 */
export function canAccessScenarios(mode: DataMode): boolean {
  return getModeConfig(mode).allowScenarios;
}

/**
 * Check if simulated data is allowed (non-throwing version)
 */
export function canUseSimulatedData(mode: DataMode): boolean {
  return getModeConfig(mode).allowSimulatedData;
}

/**
 * Check if live API is required (non-throwing version)
 */
export function requiresLiveAPI(mode: DataMode): boolean {
  return getModeConfig(mode).requireLiveAPI;
}

// =============================================================================
// Mode-Aware Fetch Wrapper
// =============================================================================

export interface ModeAwareFetchOptions {
  /** Data mode - PRACTICE or COMPANION (named dataMode to avoid conflict with RequestInit.mode) */
  dataMode: DataMode;
  /** If true, will throw instead of falling back when live API fails in COMPANION mode */
  strict?: boolean;
}

/**
 * Mode-aware fetch wrapper that enforces data source restrictions.
 *
 * @example
 * ```ts
 * // In COMPANION mode - fetches from live API only
 * const data = await modeAwareFetch('/api/market/quote?symbol=SPY', {
 *   dataMode: 'COMPANION',
 * });
 *
 * // In PRACTICE mode - can use any source
 * const scenario = await modeAwareFetch('/api/practice/scenarios/123', {
 *   dataMode: 'PRACTICE',
 * });
 * ```
 */
export async function modeAwareFetch<T>(
  url: string,
  options: ModeAwareFetchOptions & RequestInit
): Promise<T> {
  const { dataMode, strict = false, ...fetchOptions } = options as ModeAwareFetchOptions & Record<string, unknown>;
  const config = getModeConfig(dataMode);

  // Check for scenario access attempts in COMPANION mode
  if (url.includes('/practice/') || url.includes('/scenarios/')) {
    if (!config.allowScenarios) {
      throw new DataIntegrityError(
        `Attempted to fetch practice/scenario data in ${dataMode} mode: ${url}`,
        dataMode,
        'scenarios'
      );
    }
  }

  // In COMPANION mode with strict=true, throw on any failure
  try {
    const response = await fetch(url, fetchOptions as RequestInit);

    if (!response.ok) {
      const error = await response.text();

      // In strict COMPANION mode, we cannot fall back
      if (dataMode === 'COMPANION' && strict) {
        throw new DataIntegrityError(
          `Live API failed in COMPANION mode (strict): ${response.status} - ${error}`,
          dataMode,
          'api'
        );
      }

      throw new Error(`Fetch failed: ${response.status} - ${error}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof DataIntegrityError) {
      throw error;
    }

    // In strict COMPANION mode, don't allow fallbacks
    if (dataMode === 'COMPANION' && strict) {
      throw new DataIntegrityError(
        `Live API required in COMPANION mode but failed: ${error}`,
        dataMode,
        'api'
      );
    }

    throw error;
  }
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Validate that market data came from a live source, not scenarios.
 * Call this on data received to ensure it's not contaminated.
 */
export function validateLiveData(
  data: unknown,
  mode: DataMode
): void {
  if (mode !== 'COMPANION') return;

  // Check for scenario markers
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Check for common scenario/practice data markers
    const suspiciousKeys = [
      'scenarioId',
      'practiceSessionId',
      'isSimulated',
      'simulatedAt',
      'generatedBy',
    ];

    for (const key of suspiciousKeys) {
      if (key in obj) {
        throw new DataIntegrityError(
          `Data contains scenario marker '${key}' but mode is COMPANION`,
          mode,
          'validation'
        );
      }
    }
  }
}

/**
 * Strip any scenario/practice markers from data before using in COMPANION mode.
 * Use this as a fallback safety measure.
 */
export function sanitizeForCompanionMode<T extends Record<string, unknown>>(
  data: T
): T {
  const sanitized = { ...data };

  const keysToRemove = [
    'scenarioId',
    'practiceSessionId',
    'isSimulated',
    'simulatedAt',
    'generatedBy',
    '_practice',
    '_scenario',
  ];

  for (const key of keysToRemove) {
    delete sanitized[key];
  }

  return sanitized;
}

// =============================================================================
// Logging
// =============================================================================

/**
 * Log a data integrity event for auditing.
 */
export function logDataIntegrityEvent(
  event: 'access_denied' | 'validation_failed' | 'mode_switch',
  details: {
    mode: DataMode;
    source?: string;
    error?: string;
    context?: string;
  }
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    ...details,
  };

  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.warn('[DataIntegrity]', logEntry);
  }

  // In production, you might send this to a monitoring service
  // sendToMonitoring(logEntry);
}
