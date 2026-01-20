/**
 * Gamma Exposure API Endpoint
 *
 * Provides gamma exposure data including call/put walls, max pain,
 * and gamma flip levels using real options chain data from Massive.com.
 */

import { NextRequest, NextResponse } from 'next/server';
import { marketDataService, type OptionContract } from '@/lib/market-data';

interface GammaLevel {
  strike: number;
  callOI: number;
  putOI: number;
  callGamma: number;
  putGamma: number;
  netGamma: number;
  significance: 'high' | 'medium' | 'low';
}

interface GammaExposure {
  symbol: string;
  timestamp: string;
  currentPrice: number;
  maxPain: number;
  gammaFlip: number;
  callWall: number;
  putWall: number;
  zeroGammaLevel: number;
  regime: 'positive' | 'negative' | 'neutral';
  dealerPositioning: 'long_gamma' | 'short_gamma' | 'neutral';
  expectedMove: {
    daily: number;
    weekly: number;
  };
  keyLevels: GammaLevel[];
  analysis: {
    summary: string;
    tradingImplication: string;
    supportLevels: number[];
    resistanceLevels: number[];
  };
}

/**
 * Calculate gamma exposure from real options chain data
 */
function calculateGammaFromOptionsChain(
  symbol: string,
  currentPrice: number,
  calls: OptionContract[],
  puts: OptionContract[]
): GammaExposure {
  // Build gamma levels from options chain
  const strikeMap = new Map<number, GammaLevel>();

  // Process calls
  for (const call of calls) {
    const existing = strikeMap.get(call.strike) || {
      strike: call.strike,
      callOI: 0,
      putOI: 0,
      callGamma: 0,
      putGamma: 0,
      netGamma: 0,
      significance: 'low' as const,
    };

    existing.callOI += call.openInterest;
    // Gamma * OI * 100 (100 shares per contract)
    existing.callGamma += (call.gamma || 0) * call.openInterest * 100;

    strikeMap.set(call.strike, existing);
  }

  // Process puts
  for (const put of puts) {
    const existing = strikeMap.get(put.strike) || {
      strike: put.strike,
      callOI: 0,
      putOI: 0,
      callGamma: 0,
      putGamma: 0,
      netGamma: 0,
      significance: 'low' as const,
    };

    existing.putOI += put.openInterest;
    // Put gamma (dealers are short puts, so gamma is negative for them)
    existing.putGamma += (put.gamma || 0) * put.openInterest * 100;

    strikeMap.set(put.strike, existing);
  }

  // Calculate net gamma and significance
  const gammaLevels: GammaLevel[] = [];
  let maxNetGamma = 0;

  Array.from(strikeMap.values()).forEach(level => {
    level.netGamma = level.callGamma - level.putGamma;
    maxNetGamma = Math.max(maxNetGamma, Math.abs(level.netGamma));
    gammaLevels.push(level);
  });

  // Determine significance thresholds
  const highThreshold = maxNetGamma * 0.7;
  const mediumThreshold = maxNetGamma * 0.3;

  for (const level of gammaLevels) {
    level.significance =
      Math.abs(level.netGamma) > highThreshold ? 'high' :
      Math.abs(level.netGamma) > mediumThreshold ? 'medium' : 'low';
  }

  // Sort by strike
  gammaLevels.sort((a, b) => a.strike - b.strike);

  // Find max pain (strike with minimum total pain)
  let maxPainStrike = currentPrice;
  let minPain = Infinity;

  for (const level of gammaLevels) {
    let pain = 0;
    for (const other of gammaLevels) {
      if (other.strike < level.strike) {
        pain += other.callOI * (level.strike - other.strike) * 100;
      } else if (other.strike > level.strike) {
        pain += other.putOI * (other.strike - level.strike) * 100;
      }
    }
    if (pain < minPain) {
      minPain = pain;
      maxPainStrike = level.strike;
    }
  }

  // Find call wall (highest call OI above price)
  const callWall = gammaLevels
    .filter(l => l.strike > currentPrice)
    .sort((a, b) => b.callOI - a.callOI)[0]?.strike || currentPrice * 1.05;

  // Find put wall (highest put OI below price)
  const putWall = gammaLevels
    .filter(l => l.strike < currentPrice)
    .sort((a, b) => b.putOI - a.putOI)[0]?.strike || currentPrice * 0.95;

  // Find gamma flip (where cumulative net gamma crosses zero)
  let gammaFlip = currentPrice;
  let cumulativeGamma = 0;
  let foundFlip = false;

  for (let i = 0; i < gammaLevels.length - 1; i++) {
    const prevCumulative = cumulativeGamma;
    cumulativeGamma += gammaLevels[i].netGamma;

    if (!foundFlip && prevCumulative * cumulativeGamma < 0) {
      // Interpolate
      gammaFlip = (gammaLevels[i].strike + gammaLevels[i + 1].strike) / 2;
      foundFlip = true;
    }
  }

  // Determine regime based on nearest level to current price
  const nearestLevel = gammaLevels.reduce((nearest, level) =>
    Math.abs(level.strike - currentPrice) < Math.abs(nearest.strike - currentPrice) ? level : nearest,
    gammaLevels[0] || { strike: currentPrice, netGamma: 0 }
  );

  const regime: 'positive' | 'negative' | 'neutral' =
    nearestLevel.netGamma > maxNetGamma * 0.1 ? 'positive' :
    nearestLevel.netGamma < -maxNetGamma * 0.1 ? 'negative' : 'neutral';

  // Dealer positioning
  const totalNetGamma = gammaLevels.reduce((sum, l) => sum + l.netGamma, 0);
  const dealerPositioning: 'long_gamma' | 'short_gamma' | 'neutral' =
    totalNetGamma > maxNetGamma * 0.5 ? 'long_gamma' :
    totalNetGamma < -maxNetGamma * 0.5 ? 'short_gamma' : 'neutral';

  // Calculate expected move from average IV
  const avgIV = [...calls, ...puts].reduce((sum, opt) => sum + (opt.impliedVolatility || 0.25), 0) /
    Math.max(calls.length + puts.length, 1);

  const dailyMove = currentPrice * avgIV * Math.sqrt(1 / 252);
  const weeklyMove = currentPrice * avgIV * Math.sqrt(5 / 252);

  // Get support/resistance from high-significance levels
  const resistanceLevels = gammaLevels
    .filter(l => l.strike > currentPrice && l.significance !== 'low')
    .slice(0, 3)
    .map(l => l.strike);

  const supportLevels = gammaLevels
    .filter(l => l.strike < currentPrice && l.significance !== 'low')
    .slice(-3)
    .reverse()
    .map(l => l.strike);

  // Generate analysis
  let summary = '';
  let tradingImplication = '';

  if (regime === 'positive') {
    summary = `${symbol} is in a positive gamma environment. Dealers are long gamma, providing liquidity and dampening volatility.`;
    tradingImplication = 'Mean reversion favored. Price gravitates to max pain. Consider selling premium.';
  } else if (regime === 'negative') {
    summary = `${symbol} is in a negative gamma environment. Dealers are short gamma, amplifying directional moves.`;
    tradingImplication = 'Trend-following favored. Breakouts can accelerate. Watch for gamma squeezes.';
  } else {
    summary = `${symbol} is in a neutral gamma zone near the flip level.`;
    tradingImplication = 'Watch for regime shift. Mixed strategies recommended.';
  }

  return {
    symbol,
    timestamp: new Date().toISOString(),
    currentPrice,
    maxPain: maxPainStrike,
    gammaFlip,
    callWall,
    putWall,
    zeroGammaLevel: gammaFlip,
    regime,
    dealerPositioning,
    expectedMove: {
      daily: Math.round(dailyMove * 100) / 100,
      weekly: Math.round(weeklyMove * 100) / 100,
    },
    keyLevels: gammaLevels.filter(l => l.significance !== 'low'),
    analysis: {
      summary,
      tradingImplication,
      supportLevels,
      resistanceLevels,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    const upperSymbol = symbol.toUpperCase();

    // Get current price
    const quote = await marketDataService.getQuote(upperSymbol);

    if (!quote || !quote.price) {
      return NextResponse.json(
        { error: `Unable to fetch price for ${symbol}` },
        { status: 404 }
      );
    }

    // Get real options chain data
    const optionsChain = await marketDataService.getOptionsChain(upperSymbol);

    if (!optionsChain || optionsChain.calls.length === 0 || optionsChain.puts.length === 0) {
      return NextResponse.json(
        { error: `Options chain data unavailable for ${upperSymbol}` },
        { status: 404 }
      );
    }

    const gammaExposure = calculateGammaFromOptionsChain(
      upperSymbol,
      quote.price,
      optionsChain.calls,
      optionsChain.puts
    );

    return NextResponse.json(gammaExposure);

  } catch (error) {
    console.error('[Gamma API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST endpoint for batch gamma analysis
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: 'Symbols array is required' },
        { status: 400 }
      );
    }

    const limitedSymbols = symbols.slice(0, 10);
    const results: Record<string, GammaExposure | { error: string }> = {};

    for (const symbol of limitedSymbols) {
      try {
        const upperSymbol = symbol.toUpperCase();
        const quote = await marketDataService.getQuote(upperSymbol);

        if (quote && quote.price) {
          const optionsChain = await marketDataService.getOptionsChain(upperSymbol);

          if (optionsChain && optionsChain.calls.length > 0 && optionsChain.puts.length > 0) {
            results[upperSymbol] = calculateGammaFromOptionsChain(
              upperSymbol,
              quote.price,
              optionsChain.calls,
              optionsChain.puts
            );
          } else {
            results[upperSymbol] = { error: 'Options chain data unavailable' };
          }
        } else {
          results[upperSymbol] = { error: 'Unable to fetch price' };
        }
      } catch {
        results[symbol.toUpperCase()] = { error: 'Failed to analyze' };
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Gamma API] Batch Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
