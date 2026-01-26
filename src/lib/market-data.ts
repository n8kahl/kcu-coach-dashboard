/**
 * Market Data Service
 *
 * This file re-exports from the modular market-data/ directory.
 * All functionality has been decomposed into:
 *
 * - market-data/types.ts: Type definitions (~350 lines)
 * - market-data/cache.ts: Caching utilities (~120 lines)
 * - market-data/service.ts: Main service class (~1400 lines)
 * - market-data/index.ts: Public API exports
 *
 * Import from '@/lib/market-data' as before - the API is unchanged.
 */

export * from './market-data/index';
export { default } from './market-data/index';
