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
  dataSource: 'real' | 'synthetic';
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
    dataSource: 'real',
  };
}

/**
 * Fallback: Calculate gamma with synthetic data when options chain unavailable
 */
function calculateSyntheticGamma(
  symbol: string,
  currentPrice: number,
  volatility: number = 0.25
): GammaExposure {
  const strikeSpacing = currentPrice > 100 ? 5 : currentPrice > 50 ? 2.5 : 1;
  const numStrikes = 20;
  const strikes: number[] = [];

  const baseStrike = Math.round(currentPrice / strikeSpacing) * strikeSpacing;
  for (let i = -numStrikes / 2; i <= numStrikes / 2; i++) {
    strikes.push(baseStrike + i * strikeSpacing);
  }

  const gammaLevels: GammaLevel[] = strikes.map((strike) => {
    const distanceFromPrice = Math.abs(strike - currentPrice) / currentPrice;
    const moneyness = strike / currentPrice;

    const isRoundNumber = strike % 10 === 0;
    const atmMultiplier = Math.exp(-Math.pow(distanceFromPrice, 2) * 50);

    const baseCallOI = 5000 + Math.random() * 10000;
    const basePutOI = 5000 + Math.random() * 10000;

    const callOI = Math.round(
      baseCallOI * atmMultiplier * (moneyness > 1 ? 1.5 : 0.8) * (isRoundNumber ? 2 : 1)
    );
    const putOI = Math.round(
      basePutOI * atmMultiplier * (moneyness < 1 ? 1.5 : 0.8) * (isRoundNumber ? 2 : 1)
    );

    const timeToExpiry = 7 / 365;
    const d1 = (Math.log(currentPrice / strike) + (0.02 + volatility * volatility / 2) * timeToExpiry) /
               (volatility * Math.sqrt(timeToExpiry));
    const gamma = Math.exp(-d1 * d1 / 2) / (currentPrice * volatility * Math.sqrt(2 * Math.PI * timeToExpiry));

    const callGamma = gamma * callOI * 100;
    const putGamma = gamma * putOI * 100;
    const netGamma = callGamma - putGamma;

    return {
      strike,
      callOI,
      putOI,
      callGamma: Math.round(callGamma),
      putGamma: Math.round(putGamma),
      netGamma: Math.round(netGamma),
      significance: Math.abs(netGamma) > 1000000 ? 'high' as const :
                    Math.abs(netGamma) > 500000 ? 'medium' as const : 'low' as const,
    };
  });

  // Find max pain
  let maxPainStrike = strikes[Math.floor(strikes.length / 2)];
  let minPain = Infinity;

  for (const strike of strikes) {
    let pain = 0;
    for (const level of gammaLevels) {
      if (level.strike < strike) {
        pain += level.callOI * (strike - level.strike);
      } else if (level.strike > strike) {
        pain += level.putOI * (level.strike - strike);
      }
    }
    if (pain < minPain) {
      minPain = pain;
      maxPainStrike = strike;
    }
  }

  const callWall = gammaLevels.reduce((max, level) =>
    level.callOI > (gammaLevels.find(l => l.strike === max)?.callOI || 0) ? level.strike : max,
    strikes[Math.floor(strikes.length / 2)]
  );

  const putWall = gammaLevels.reduce((max, level) =>
    level.putOI > (gammaLevels.find(l => l.strike === max)?.putOI || 0) ? level.strike : max,
    strikes[Math.floor(strikes.length / 2)]
  );

  let gammaFlip = currentPrice;
  for (let i = 1; i < gammaLevels.length; i++) {
    if (gammaLevels[i - 1].netGamma * gammaLevels[i].netGamma < 0) {
      gammaFlip = (gammaLevels[i - 1].strike + gammaLevels[i].strike) / 2;
      break;
    }
  }

  const nearestLevel = gammaLevels.reduce((nearest, level) =>
    Math.abs(level.strike - currentPrice) < Math.abs(nearest.strike - currentPrice) ? level : nearest
  );

  const regime: 'positive' | 'negative' | 'neutral' =
    nearestLevel.netGamma > 100000 ? 'positive' :
    nearestLevel.netGamma < -100000 ? 'negative' : 'neutral';

  const totalNetGamma = gammaLevels.reduce((sum, l) => sum + l.netGamma, 0);
  const dealerPositioning: 'long_gamma' | 'short_gamma' | 'neutral' =
    totalNetGamma > 1000000 ? 'long_gamma' :
    totalNetGamma < -1000000 ? 'short_gamma' : 'neutral';

  const dailyMove = currentPrice * volatility * Math.sqrt(1 / 252);
  const weeklyMove = currentPrice * volatility * Math.sqrt(5 / 252);

  const resistanceLevels = gammaLevels
    .filter(l => l.strike > currentPrice && l.significance !== 'low')
    .sort((a, b) => Math.abs(b.netGamma) - Math.abs(a.netGamma))
    .slice(0, 3)
    .map(l => l.strike)
    .sort((a, b) => a - b);

  const supportLevels = gammaLevels
    .filter(l => l.strike < currentPrice && l.significance !== 'low')
    .sort((a, b) => Math.abs(b.netGamma) - Math.abs(a.netGamma))
    .slice(0, 3)
    .map(l => l.strike)
    .sort((a, b) => b - a);

  let summary = '';
  let tradingImplication = '';

  if (regime === 'positive') {
    summary = `${symbol} is in a positive gamma environment (estimated). Dealers are long gamma.`;
    tradingImplication = 'Mean reversion favored. Consider selling premium.';
  } else if (regime === 'negative') {
    summary = `${symbol} is in a negative gamma environment (estimated). Dealers are short gamma.`;
    tradingImplication = 'Trend-following favored. Watch for gamma squeezes.';
  } else {
    summary = `${symbol} is in a neutral gamma zone (estimated).`;
    tradingImplication = 'Watch for regime shift.';
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
    dataSource: 'synthetic',
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

    // Try to get real options chain data
    const optionsChain = await marketDataService.getOptionsChain(upperSymbol);

    let gammaExposure: GammaExposure;

    if (optionsChain && optionsChain.calls.length > 0 && optionsChain.puts.length > 0) {
      // Use real options data
      gammaExposure = calculateGammaFromOptionsChain(
        upperSymbol,
        quote.price,
        optionsChain.calls,
        optionsChain.puts
      );
    } else {
      // Fallback to synthetic data
      console.log(`[Gamma API] No options chain for ${upperSymbol}, using synthetic data`);
      const volatility = 0.20 + Math.random() * 0.15;
      gammaExposure = calculateSyntheticGamma(upperSymbol, quote.price, volatility);
    }

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
            const volatility = 0.20 + Math.random() * 0.15;
            results[upperSymbol] = calculateSyntheticGamma(upperSymbol, quote.price, volatility);
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
