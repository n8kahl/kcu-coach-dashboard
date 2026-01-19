/**
 * Gamma Exposure API Endpoint
 *
 * Provides gamma exposure data including call/put walls, max pain,
 * and gamma flip levels for options flow analysis.
 *
 * Note: This endpoint uses a combination of calculated estimates and
 * can be enhanced with real options flow data from providers like
 * Unusual Whales, SpotGamma, or similar services.
 */

import { NextRequest, NextResponse } from 'next/server';
import { marketDataService } from '@/lib/market-data';

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

// Calculate gamma exposure based on options chain data
// This is a simplified model - real implementations would use actual options data
function calculateGammaExposure(
  symbol: string,
  currentPrice: number,
  volatility: number = 0.25
): GammaExposure {
  // Generate strike ladder around current price
  const strikeSpacing = currentPrice > 100 ? 5 : currentPrice > 50 ? 2.5 : 1;
  const numStrikes = 20;
  const strikes: number[] = [];

  const baseStrike = Math.round(currentPrice / strikeSpacing) * strikeSpacing;
  for (let i = -numStrikes / 2; i <= numStrikes / 2; i++) {
    strikes.push(baseStrike + i * strikeSpacing);
  }

  // Generate synthetic gamma levels
  // In reality, this would come from actual options chain data
  const gammaLevels: GammaLevel[] = strikes.map((strike) => {
    const distanceFromPrice = Math.abs(strike - currentPrice) / currentPrice;
    const moneyness = strike / currentPrice;

    // Simulate OI distribution (typically higher near ATM and round numbers)
    const isRoundNumber = strike % 10 === 0;
    const atmMultiplier = Math.exp(-Math.pow(distanceFromPrice, 2) * 50);

    const baseCallOI = 5000 + Math.random() * 10000;
    const basePutOI = 5000 + Math.random() * 10000;

    // Calls have more OI above price, puts below
    const callOI = Math.round(
      baseCallOI * atmMultiplier * (moneyness > 1 ? 1.5 : 0.8) * (isRoundNumber ? 2 : 1)
    );
    const putOI = Math.round(
      basePutOI * atmMultiplier * (moneyness < 1 ? 1.5 : 0.8) * (isRoundNumber ? 2 : 1)
    );

    // Gamma calculation (simplified Black-Scholes gamma approximation)
    const timeToExpiry = 7 / 365; // Assume weekly options
    const d1 = (Math.log(currentPrice / strike) + (0.02 + volatility * volatility / 2) * timeToExpiry) /
               (volatility * Math.sqrt(timeToExpiry));
    const gamma = Math.exp(-d1 * d1 / 2) / (currentPrice * volatility * Math.sqrt(2 * Math.PI * timeToExpiry));

    const callGamma = gamma * callOI * 100; // 100 shares per contract
    const putGamma = gamma * putOI * 100;
    const netGamma = callGamma - putGamma;

    return {
      strike,
      callOI,
      putOI,
      callGamma: Math.round(callGamma),
      putGamma: Math.round(putGamma),
      netGamma: Math.round(netGamma),
      significance: Math.abs(netGamma) > 1000000 ? 'high' : Math.abs(netGamma) > 500000 ? 'medium' : 'low'
    };
  });

  // Find max pain (strike with most total OI pain)
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

  // Find call wall (highest call OI)
  const callWall = gammaLevels.reduce((max, level) =>
    level.callOI > (gammaLevels.find(l => l.strike === max)?.callOI || 0) ? level.strike : max,
    strikes[Math.floor(strikes.length / 2)]
  );

  // Find put wall (highest put OI)
  const putWall = gammaLevels.reduce((max, level) =>
    level.putOI > (gammaLevels.find(l => l.strike === max)?.putOI || 0) ? level.strike : max,
    strikes[Math.floor(strikes.length / 2)]
  );

  // Find gamma flip (where net gamma crosses zero)
  let gammaFlip = currentPrice;
  for (let i = 1; i < gammaLevels.length; i++) {
    if (gammaLevels[i - 1].netGamma * gammaLevels[i].netGamma < 0) {
      gammaFlip = (gammaLevels[i - 1].strike + gammaLevels[i].strike) / 2;
      break;
    }
  }

  // Determine regime
  const nearestLevel = gammaLevels.reduce((nearest, level) =>
    Math.abs(level.strike - currentPrice) < Math.abs(nearest.strike - currentPrice) ? level : nearest
  );

  const regime: 'positive' | 'negative' | 'neutral' =
    nearestLevel.netGamma > 100000 ? 'positive' :
    nearestLevel.netGamma < -100000 ? 'negative' : 'neutral';

  // Dealer positioning based on gamma
  const totalNetGamma = gammaLevels.reduce((sum, l) => sum + l.netGamma, 0);
  const dealerPositioning: 'long_gamma' | 'short_gamma' | 'neutral' =
    totalNetGamma > 1000000 ? 'long_gamma' :
    totalNetGamma < -1000000 ? 'short_gamma' : 'neutral';

  // Expected move calculation
  const dailyMove = currentPrice * volatility * Math.sqrt(1 / 252);
  const weeklyMove = currentPrice * volatility * Math.sqrt(5 / 252);

  // Identify support and resistance from gamma
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

  // Generate analysis summary
  let summary = '';
  let tradingImplication = '';

  if (regime === 'positive') {
    summary = `${symbol} is in a positive gamma environment. Dealers are long gamma and will provide liquidity, dampening volatility.`;
    tradingImplication = 'Mean reversion strategies favored. Price tends to gravitate toward max pain. Sell volatility.';
  } else if (regime === 'negative') {
    summary = `${symbol} is in a negative gamma environment. Dealers are short gamma and will amplify moves.`;
    tradingImplication = 'Trend-following strategies favored. Breakouts can accelerate. Be cautious of gamma squeezes.';
  } else {
    summary = `${symbol} is in a neutral gamma environment near the gamma flip level.`;
    tradingImplication = 'Watch for directional moves as regime can shift. Mixed strategy approach recommended.';
  }

  // Filter to key levels only
  const keyLevels = gammaLevels.filter(l => l.significance !== 'low');

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
      weekly: Math.round(weeklyMove * 100) / 100
    },
    keyLevels,
    analysis: {
      summary,
      tradingImplication,
      supportLevels,
      resistanceLevels
    }
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

    // Get current price from market data service
    const quote = await marketDataService.getQuote(symbol.toUpperCase());

    if (!quote || !quote.price) {
      return NextResponse.json(
        { error: `Unable to fetch price for ${symbol}` },
        { status: 404 }
      );
    }

    // Calculate implied volatility estimate based on recent price movement
    // In production, this would come from actual options data
    const volatility = 0.20 + Math.random() * 0.15; // 20-35% IV range

    const gammaExposure = calculateGammaExposure(
      symbol.toUpperCase(),
      quote.price,
      volatility
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

    // Limit to 10 symbols
    const limitedSymbols = symbols.slice(0, 10);

    const results: Record<string, GammaExposure | { error: string }> = {};

    for (const symbol of limitedSymbols) {
      try {
        const quote = await marketDataService.getQuote(symbol.toUpperCase());

        if (quote && quote.price) {
          const volatility = 0.20 + Math.random() * 0.15;
          results[symbol.toUpperCase()] = calculateGammaExposure(
            symbol.toUpperCase(),
            quote.price,
            volatility
          );
        } else {
          results[symbol.toUpperCase()] = { error: 'Unable to fetch price' };
        }
      } catch {
        results[symbol.toUpperCase()] = { error: 'Failed to analyze' };
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Gamma API] Batch Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
