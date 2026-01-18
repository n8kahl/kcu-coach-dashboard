/**
 * Next.js Instrumentation
 *
 * This file runs once when the server starts.
 * Used to initialize background services like the LTP detector.
 */

// Cleanup interval in milliseconds (every 6 hours)
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Briefing check interval (every 15 minutes)
const BRIEFING_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Clean up expired key levels from the database
 */
async function cleanupExpiredLevels() {
  try {
    const { supabaseAdmin } = await import('./lib/supabase');
    const logger = (await import('./lib/logger')).default;

    const now = new Date().toISOString();

    // Delete expired key levels
    const { error, count } = await supabaseAdmin
      .from('key_levels')
      .delete({ count: 'exact' })
      .lt('expires_at', now);

    if (error) {
      logger.warn('Error cleaning up expired key levels', { error: error.message });
    } else if (count && count > 0) {
      logger.info('Cleaned up expired key levels', { count });
    }

    // Clean up old detected setups (older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: setupError, count: setupCount } = await supabaseAdmin
      .from('detected_setups')
      .delete({ count: 'exact' })
      .lt('detected_at', oneDayAgo)
      .eq('setup_stage', 'triggered');

    if (setupError) {
      logger.warn('Error cleaning up old setups', { error: setupError.message });
    } else if (setupCount && setupCount > 0) {
      logger.info('Cleaned up old triggered setups', { count: setupCount });
    }

    // Clean up stale market data cache (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('market_data_cache')
      .delete()
      .lt('updated_at', oneHourAgo);

  } catch (error) {
    const logger = (await import('./lib/logger')).default;
    logger.error('Cleanup job failed', error instanceof Error ? error : { message: String(error) });
  }
}

/**
 * Check if briefings need to be generated and generate them
 */
async function checkAndGenerateBriefings() {
  try {
    const { supabaseAdmin } = await import('./lib/supabase');
    const logger = (await import('./lib/logger')).default;
    const { generateMorningBriefing, generateEODBriefing } = await import('./lib/briefing-generator');
    const { marketDataService } = await import('./lib/market-data');

    // Skip if market data not configured
    if (!marketDataService.isConfigured()) {
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0 = Sunday

    // Check if it's a weekday (market day)
    if (currentDay === 0 || currentDay === 6) {
      return; // Skip weekends
    }

    // Get briefing configs
    const { data: configs } = await supabaseAdmin
      .from('briefing_configs')
      .select('*')
      .eq('enabled', true);

    if (!configs) return;

    for (const config of configs) {
      // Parse schedule time (HH:MM:SS)
      const [scheduleHour, scheduleMinute] = config.schedule_time.split(':').map(Number);

      // Check if current time is within 15 minutes after schedule time
      const isScheduledTime =
        currentHour === scheduleHour &&
        currentMinute >= scheduleMinute &&
        currentMinute < scheduleMinute + 15;

      if (!isScheduledTime) continue;

      // Check if already generated today
      const today = now.toISOString().split('T')[0];
      const { data: existing } = await supabaseAdmin
        .from('briefings')
        .select('id')
        .eq('briefing_type', config.briefing_type)
        .gte('generated_at', today)
        .limit(1);

      if (existing && existing.length > 0) {
        continue; // Already generated today
      }

      // Generate the briefing
      logger.info('Auto-generating briefing', { type: config.briefing_type });

      if (config.briefing_type === 'morning') {
        await generateMorningBriefing();
      } else if (config.briefing_type === 'eod') {
        await generateEODBriefing();
      }
    }

  } catch (error) {
    const logger = (await import('./lib/logger')).default;
    logger.error('Briefing scheduler check failed', error instanceof Error ? error : { message: String(error) });
  }
}

export async function register() {
  // Only run on server runtime (not edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startDetector, addSymbols } = await import('./lib/ltp-detector');
    const { marketDataService } = await import('./lib/market-data');
    const logger = (await import('./lib/logger')).default;

    // Check if market data is configured
    if (!marketDataService.isConfigured()) {
      logger.warn('LTP Detector not started - MASSIVE_API_KEY not configured');
      return;
    }

    // Load shared watchlist symbols from database
    try {
      const { supabaseAdmin } = await import('./lib/supabase');

      // Get admin/shared watchlist symbols
      const { data: sharedWatchlists } = await supabaseAdmin
        .from('watchlists')
        .select('symbols')
        .eq('is_shared', true)
        .eq('is_admin_watchlist', true);

      if (sharedWatchlists && sharedWatchlists.length > 0) {
        const symbols = sharedWatchlists.flatMap(w => w.symbols || []);
        if (symbols.length > 0) {
          addSymbols(symbols);
          logger.info('Added shared watchlist symbols to detector', { count: symbols.length });
        }
      }

      // Start the detector
      startDetector();
      logger.info('LTP Detector started successfully');

      // Run initial cleanup
      cleanupExpiredLevels();

      // Schedule periodic cleanup
      setInterval(cleanupExpiredLevels, CLEANUP_INTERVAL_MS);
      logger.info('Scheduled cleanup job', { intervalHours: CLEANUP_INTERVAL_MS / (60 * 60 * 1000) });

      // Schedule briefing checks
      setInterval(checkAndGenerateBriefings, BRIEFING_CHECK_INTERVAL_MS);
      logger.info('Scheduled briefing checker', { intervalMinutes: BRIEFING_CHECK_INTERVAL_MS / (60 * 1000) });

      // Run initial briefing check
      checkAndGenerateBriefings();

    } catch (error) {
      logger.error('Failed to start LTP Detector', error instanceof Error ? error : { message: String(error) });
    }
  }
}
