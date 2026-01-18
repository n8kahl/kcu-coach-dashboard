/**
 * Options Analysis Service
 *
 * Provides options-specific analysis for trading decisions:
 * - Options chain analysis
 * - Greeks calculations and interpretation
 * - Implied volatility analysis
 * - Options flow (unusual activity)
 * - Strike selection guidance
 */

class OptionsService {
  constructor(marketDataService) {
    this.marketData = marketDataService;
    this.cache = new Map();
    this.cacheTTL = 60000; // 1 minute cache for options data
  }

  /**
   * Get options chain with Greeks for a ticker
   */
  async getOptionsChain(symbol, expirationDays = 7) {
    const cacheKey = `chain_${symbol}_${expirationDays}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      // Get current stock price
      const quote = this.marketData ? await this.marketData.getQuote(symbol) : null;
      const currentPrice = quote?.price || quote?.last;

      if (!currentPrice) {
        return { error: 'Unable to fetch quote data' };
      }

      // Calculate target expiration date
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + expirationDays);

      // Fetch options chain from Massive.com
      const apiKey = process.env.MASSIVE_API_KEY;
      const response = await fetch(
        `https://api.massive.com/v3/snapshot/options/${symbol}?apiKey=${apiKey}`
      );

      if (!response.ok) {
        console.error('Options chain fetch failed:', response.status);
        return this.generateSyntheticChain(symbol, currentPrice, expirationDays);
      }

      const data = await response.json();

      // Process and filter options
      const chain = this.processOptionsChain(data, currentPrice, targetDate);

      const result = {
        symbol,
        underlyingPrice: currentPrice,
        expirationDays,
        timestamp: new Date().toISOString(),
        ...chain,
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error('Error fetching options chain:', error);
      const quote = this.marketData ? await this.marketData.getQuote(symbol) : null;
      return this.generateSyntheticChain(symbol, quote?.price || 0, expirationDays);
    }
  }

  /**
   * Process raw options chain data
   */
  processOptionsChain(data, currentPrice, targetDate) {
    const calls = [];
    const puts = [];

    if (!data.results) {
      return { calls: [], puts: [], atmStrike: Math.round(currentPrice) };
    }

    // Find closest expiration to target
    const expirations = Array.from(new Set(data.results.map(o => o.expiration_date))).sort();
    const targetTimestamp = targetDate.getTime();

    let closestExpiration = expirations[0];
    let minDiff = Infinity;

    for (const exp of expirations) {
      const diff = Math.abs(new Date(exp).getTime() - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestExpiration = exp;
      }
    }

    // Filter options for this expiration
    const filteredOptions = data.results.filter(o => o.expiration_date === closestExpiration);

    // Find ATM strike
    const strikes = Array.from(new Set(filteredOptions.map(o => o.strike_price))).sort((a, b) => a - b);
    const atmStrike = strikes.reduce((prev, curr) =>
      Math.abs(curr - currentPrice) < Math.abs(prev - currentPrice) ? curr : prev
    );

    // Get strikes near ATM (5 above, 5 below)
    const atmIndex = strikes.indexOf(atmStrike);
    const relevantStrikes = strikes.slice(Math.max(0, atmIndex - 5), atmIndex + 6);

    for (const option of filteredOptions) {
      if (!relevantStrikes.includes(option.strike_price)) continue;

      const optionData = {
        strike: option.strike_price,
        expiration: option.expiration_date,
        bid: option.day?.close || option.last_quote?.bid || 0,
        ask: option.day?.close || option.last_quote?.ask || 0,
        lastPrice: option.day?.close || 0,
        volume: option.day?.volume || 0,
        openInterest: option.open_interest || 0,
        impliedVolatility: option.implied_volatility || 0,
        greeks: option.greeks || this.calculateGreeks(option, currentPrice),
        moneyness: this.calculateMoneyness(option.strike_price, currentPrice, option.contract_type),
      };

      if (option.contract_type === 'call') {
        calls.push(optionData);
      } else {
        puts.push(optionData);
      }
    }

    // Sort by strike
    calls.sort((a, b) => a.strike - b.strike);
    puts.sort((a, b) => a.strike - b.strike);

    return {
      calls,
      puts,
      atmStrike,
      expiration: closestExpiration,
      daysToExpiration: Math.ceil((new Date(closestExpiration) - new Date()) / (1000 * 60 * 60 * 24)),
    };
  }

  /**
   * Calculate moneyness (ITM, ATM, OTM)
   */
  calculateMoneyness(strike, currentPrice, contractType) {
    const diff = ((strike - currentPrice) / currentPrice) * 100;

    if (Math.abs(diff) < 1) return 'ATM';

    if (contractType === 'call') {
      return strike < currentPrice ? 'ITM' : 'OTM';
    } else {
      return strike > currentPrice ? 'ITM' : 'OTM';
    }
  }

  /**
   * Calculate simplified Greeks when not provided by API
   */
  calculateGreeks(option, currentPrice) {
    const strike = option.strike_price;
    const daysToExp = Math.max(1, Math.ceil(
      (new Date(option.expiration_date) - new Date()) / (1000 * 60 * 60 * 24)
    ));
    const iv = option.implied_volatility || 0.30; // Default 30% IV

    // Simplified Black-Scholes approximations
    const timeToExp = daysToExp / 365;
    const sqrtTime = Math.sqrt(timeToExp);

    // Rough delta approximation
    const moneyness = currentPrice / strike;
    let delta;
    if (option.contract_type === 'call') {
      delta = moneyness > 1.1 ? 0.85 : moneyness < 0.9 ? 0.15 : 0.5;
    } else {
      delta = moneyness > 1.1 ? -0.15 : moneyness < 0.9 ? -0.85 : -0.5;
    }

    // Theta approximation (daily decay)
    const optionPrice = option.day?.close || (currentPrice * iv * sqrtTime * 0.4);
    const theta = -(optionPrice * iv) / (2 * sqrtTime * 365);

    // Gamma approximation
    const gamma = 0.02 / sqrtTime;

    // Vega approximation
    const vega = currentPrice * sqrtTime * 0.01;

    return {
      delta: Math.round(delta * 100) / 100,
      gamma: Math.round(gamma * 1000) / 1000,
      theta: Math.round(theta * 100) / 100,
      vega: Math.round(vega * 100) / 100,
      iv: Math.round(iv * 100),
    };
  }

  /**
   * Generate synthetic options chain when API unavailable
   */
  generateSyntheticChain(symbol, currentPrice, expirationDays) {
    if (!currentPrice) {
      return { error: 'Unable to generate options chain without price data' };
    }

    const atmStrike = Math.round(currentPrice);
    const strikes = [];

    // Generate strikes around ATM
    for (let i = -5; i <= 5; i++) {
      strikes.push(atmStrike + i);
    }

    const calls = [];
    const puts = [];
    const iv = 0.25; // Assume 25% IV
    const sqrtTime = Math.sqrt(expirationDays / 365);

    for (const strike of strikes) {
      const intrinsicCall = Math.max(0, currentPrice - strike);
      const intrinsicPut = Math.max(0, strike - currentPrice);
      const timeValue = currentPrice * iv * sqrtTime * 0.4;

      const callPrice = intrinsicCall + timeValue * (strike >= currentPrice ? 1 : 0.5);
      const putPrice = intrinsicPut + timeValue * (strike <= currentPrice ? 1 : 0.5);

      const callDelta = strike < currentPrice ? 0.75 + (currentPrice - strike) * 0.05 :
                        strike > currentPrice ? 0.25 - (strike - currentPrice) * 0.05 : 0.50;
      const putDelta = callDelta - 1;

      calls.push({
        strike,
        bid: Math.round(callPrice * 0.95 * 100) / 100,
        ask: Math.round(callPrice * 1.05 * 100) / 100,
        lastPrice: Math.round(callPrice * 100) / 100,
        volume: 0,
        openInterest: 0,
        greeks: {
          delta: Math.min(0.99, Math.max(0.01, Math.round(callDelta * 100) / 100)),
          theta: Math.round(-callPrice / expirationDays * 100) / 100,
          gamma: 0.02,
          vega: Math.round(currentPrice * sqrtTime * 0.01 * 100) / 100,
          iv: 25,
        },
        moneyness: strike < currentPrice ? 'ITM' : strike > currentPrice ? 'OTM' : 'ATM',
        synthetic: true,
      });

      puts.push({
        strike,
        bid: Math.round(putPrice * 0.95 * 100) / 100,
        ask: Math.round(putPrice * 1.05 * 100) / 100,
        lastPrice: Math.round(putPrice * 100) / 100,
        volume: 0,
        openInterest: 0,
        greeks: {
          delta: Math.max(-0.99, Math.min(-0.01, Math.round(putDelta * 100) / 100)),
          theta: Math.round(-putPrice / expirationDays * 100) / 100,
          gamma: 0.02,
          vega: Math.round(currentPrice * sqrtTime * 0.01 * 100) / 100,
          iv: 25,
        },
        moneyness: strike > currentPrice ? 'ITM' : strike < currentPrice ? 'OTM' : 'ATM',
        synthetic: true,
      });
    }

    return {
      symbol,
      underlyingPrice: currentPrice,
      expirationDays,
      atmStrike,
      calls,
      puts,
      synthetic: true,
      note: 'Synthetic data - actual options data unavailable',
    };
  }

  /**
   * Analyze options flow for unusual activity
   */
  async analyzeOptionsFlow(symbol) {
    const chain = await this.getOptionsChain(symbol, 30);
    if (chain.error) return chain;

    const allOptions = [...chain.calls, ...chain.puts];

    // Calculate average volume and OI
    const avgVolume = allOptions.reduce((sum, o) => sum + o.volume, 0) / allOptions.length;

    // Find unusual activity
    const unusualActivity = [];

    for (const option of allOptions) {
      // Volume spike (3x average)
      if (option.volume > avgVolume * 3 && option.volume > 100) {
        unusualActivity.push({
          type: 'VOLUME_SPIKE',
          strike: option.strike,
          optionType: chain.calls.includes(option) ? 'CALL' : 'PUT',
          volume: option.volume,
          avgVolume: Math.round(avgVolume),
          ratio: (option.volume / avgVolume).toFixed(1),
        });
      }

      // Volume > Open Interest (new positions being opened)
      if (option.volume > option.openInterest && option.volume > 50) {
        unusualActivity.push({
          type: 'NEW_POSITIONS',
          strike: option.strike,
          optionType: chain.calls.includes(option) ? 'CALL' : 'PUT',
          volume: option.volume,
          openInterest: option.openInterest,
        });
      }
    }

    // Calculate put/call ratio
    const totalCallVolume = chain.calls.reduce((sum, o) => sum + o.volume, 0);
    const totalPutVolume = chain.puts.reduce((sum, o) => sum + o.volume, 0);
    const putCallRatio = totalCallVolume > 0 ? (totalPutVolume / totalCallVolume).toFixed(2) : 0;

    // Determine sentiment
    let sentiment = 'Neutral';
    if (putCallRatio < 0.7) sentiment = 'Bullish';
    else if (putCallRatio > 1.3) sentiment = 'Bearish';

    return {
      symbol,
      putCallRatio,
      sentiment,
      totalCallVolume,
      totalPutVolume,
      unusualActivity: unusualActivity.slice(0, 5),
    };
  }

  /**
   * Get strike recommendation based on LTP setup
   */
  async getStrikeRecommendation(symbol, direction, riskTolerance = 'moderate') {
    const chain = await this.getOptionsChain(symbol, 7);
    if (chain.error) return chain;

    const options = direction === 'long' ? chain.calls : chain.puts;
    const price = chain.underlyingPrice;

    // Risk tolerance determines delta target
    const deltaTargets = {
      conservative: direction === 'long' ? 0.70 : -0.70,
      moderate: direction === 'long' ? 0.50 : -0.50,
      aggressive: direction === 'long' ? 0.30 : -0.30,
    };

    const targetDelta = deltaTargets[riskTolerance] || deltaTargets.moderate;

    // Find option closest to target delta
    let bestOption = options[0];
    let minDiff = Infinity;

    for (const option of options) {
      const diff = Math.abs(option.greeks.delta - targetDelta);
      if (diff < minDiff) {
        minDiff = diff;
        bestOption = option;
      }
    }

    // Calculate position sizing
    const maxRiskPerTrade = 100;
    const optionCost = bestOption.ask * 100;
    const suggestedContracts = Math.max(1, Math.floor(maxRiskPerTrade / (optionCost * 0.5)));

    return {
      recommendation: {
        strike: bestOption.strike,
        expiration: chain.expiration,
        type: direction === 'long' ? 'CALL' : 'PUT',
        price: bestOption.ask,
        delta: bestOption.greeks.delta,
        theta: bestOption.greeks.theta,
      },
      riskProfile: {
        maxLoss: optionCost,
        breakeven: direction === 'long'
          ? bestOption.strike + bestOption.ask
          : bestOption.strike - bestOption.ask,
        suggestedContracts,
        totalCost: optionCost * suggestedContracts,
      },
    };
  }

  /**
   * Calculate expected move based on options pricing
   */
  async getExpectedMove(symbol, expirationDays = 7) {
    const chain = await this.getOptionsChain(symbol, expirationDays);
    if (chain.error) return chain;

    const price = chain.underlyingPrice;

    // Get ATM straddle price
    const atmCall = chain.calls.find(c => c.moneyness === 'ATM') || chain.calls[Math.floor(chain.calls.length / 2)];
    const atmPut = chain.puts.find(p => p.moneyness === 'ATM') || chain.puts[Math.floor(chain.puts.length / 2)];

    if (!atmCall || !atmPut) {
      return { error: 'Unable to calculate expected move' };
    }

    const straddlePrice = atmCall.ask + atmPut.ask;
    const expectedMovePercent = (straddlePrice / price) * 100;
    const expectedMovePoints = straddlePrice;

    // Get average IV
    const avgIV = (atmCall.greeks.iv + atmPut.greeks.iv) / 2;

    return {
      symbol,
      currentPrice: price,
      expirationDays,
      straddlePrice: Math.round(straddlePrice * 100) / 100,
      expectedMove: {
        points: Math.round(expectedMovePoints * 100) / 100,
        percent: Math.round(expectedMovePercent * 10) / 10,
        upperBound: Math.round((price + expectedMovePoints) * 100) / 100,
        lowerBound: Math.round((price - expectedMovePoints) * 100) / 100,
      },
      impliedVolatility: avgIV,
    };
  }

  /**
   * Clear options cache
   */
  clearCache(symbol = null) {
    if (symbol) {
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.includes(symbol.toUpperCase())) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }
}

module.exports = OptionsService;
