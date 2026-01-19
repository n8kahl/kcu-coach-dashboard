/**
 * Paper Trading System
 *
 * Simulates a trading account with $25K starting balance.
 * Supports stocks and options with realistic execution.
 */

export interface PaperTradingAccount {
  id: string;
  userId: string;
  balance: number;
  startingBalance: number;
  equity: number; // balance + unrealized P&L
  buyingPower: number;
  dayTrades: number;
  isPDT: boolean; // Pattern Day Trader flag
  createdAt: number;
  updatedAt: number;
}

export interface Position {
  id: string;
  accountId: string;
  symbol: string;
  type: 'stock' | 'call' | 'put';
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  openedAt: number;
  updatedAt: number;
  // For options
  optionDetails?: {
    strike: number;
    expiration: string;
    delta?: number;
    theta?: number;
    contractMultiplier: number; // Usually 100
  };
}

export interface Order {
  id: string;
  accountId: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledPrice?: number;
  filledAt?: number;
  createdAt: number;
  // For options
  optionDetails?: {
    strike: number;
    expiration: string;
    putCall: 'call' | 'put';
  };
}

export interface Trade {
  id: string;
  accountId: string;
  positionId: string;
  symbol: string;
  type: 'stock' | 'call' | 'put';
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnL: number;
  realizedPnLPercent: number;
  riskRewardRatio: number;
  holdingTimeMs: number;
  openedAt: number;
  closedAt: number;
  notes?: string;
  tags?: string[];
}

export interface AccountStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  averageRR: number;
  averageHoldingTime: number;
  sharpeRatio?: number;
  maxDrawdown: number;
  currentStreak: number;
  bestStreak: number;
}

// Default starting balance
export const DEFAULT_STARTING_BALANCE = 25000;

// Commission rates (simulated)
export const COMMISSION = {
  stock: 0, // Commission-free
  option: 0.65, // Per contract
};

// Create a new paper trading account
export function createAccount(userId: string): PaperTradingAccount {
  const now = Date.now();
  return {
    id: `account-${now}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    balance: DEFAULT_STARTING_BALANCE,
    startingBalance: DEFAULT_STARTING_BALANCE,
    equity: DEFAULT_STARTING_BALANCE,
    buyingPower: DEFAULT_STARTING_BALANCE * 4, // 4x margin for day trading
    dayTrades: 0,
    isPDT: false,
    createdAt: now,
    updatedAt: now,
  };
}

// Calculate position P&L
export function calculatePositionPnL(position: Position): {
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
} {
  const multiplier = position.optionDetails?.contractMultiplier || 1;
  const positionValue = position.currentPrice * position.quantity * multiplier;
  const costBasis = position.entryPrice * position.quantity * multiplier;

  let unrealizedPnL: number;
  if (position.side === 'long') {
    unrealizedPnL = positionValue - costBasis;
  } else {
    unrealizedPnL = costBasis - positionValue;
  }

  const unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;

  return { unrealizedPnL, unrealizedPnLPercent };
}

// Open a new position
export function openPosition(
  account: PaperTradingAccount,
  params: {
    symbol: string;
    type: 'stock' | 'call' | 'put';
    side: 'long' | 'short';
    quantity: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
    optionDetails?: Position['optionDetails'];
  }
): { position: Position; updatedAccount: PaperTradingAccount; error?: string } {
  const multiplier = params.optionDetails?.contractMultiplier || 1;
  const totalCost = params.price * params.quantity * multiplier;

  // Check buying power
  if (totalCost > account.buyingPower) {
    return {
      position: null as unknown as Position,
      updatedAccount: account,
      error: 'Insufficient buying power',
    };
  }

  // Calculate commission
  const commission =
    params.type === 'stock' ? 0 : COMMISSION.option * params.quantity;

  const now = Date.now();
  const position: Position = {
    id: `pos-${now}-${Math.random().toString(36).substr(2, 9)}`,
    accountId: account.id,
    symbol: params.symbol,
    type: params.type,
    side: params.side,
    quantity: params.quantity,
    entryPrice: params.price,
    currentPrice: params.price,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    unrealizedPnL: -commission, // Start with commission loss
    unrealizedPnLPercent: 0,
    openedAt: now,
    updatedAt: now,
    optionDetails: params.optionDetails,
  };

  // Update account
  const updatedAccount: PaperTradingAccount = {
    ...account,
    balance: account.balance - commission,
    buyingPower: account.buyingPower - totalCost,
    equity: account.equity - commission,
    updatedAt: now,
  };

  return { position, updatedAccount };
}

// Close a position
export function closePosition(
  account: PaperTradingAccount,
  position: Position,
  exitPrice: number
): { trade: Trade; updatedAccount: PaperTradingAccount } {
  const multiplier = position.optionDetails?.contractMultiplier || 1;
  const exitValue = exitPrice * position.quantity * multiplier;
  const entryValue = position.entryPrice * position.quantity * multiplier;

  let realizedPnL: number;
  if (position.side === 'long') {
    realizedPnL = exitValue - entryValue;
  } else {
    realizedPnL = entryValue - exitValue;
  }

  // Subtract commission for options
  const commission =
    position.type === 'stock' ? 0 : COMMISSION.option * position.quantity;
  realizedPnL -= commission;

  const realizedPnLPercent = (realizedPnL / entryValue) * 100;

  // Calculate risk/reward if stop loss was set
  let riskRewardRatio = 0;
  if (position.stopLoss) {
    const riskPerShare = Math.abs(position.entryPrice - position.stopLoss);
    const rewardPerShare = Math.abs(exitPrice - position.entryPrice);
    riskRewardRatio = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;
  }

  const now = Date.now();
  const trade: Trade = {
    id: `trade-${now}-${Math.random().toString(36).substr(2, 9)}`,
    accountId: account.id,
    positionId: position.id,
    symbol: position.symbol,
    type: position.type,
    side: position.side,
    quantity: position.quantity,
    entryPrice: position.entryPrice,
    exitPrice,
    realizedPnL,
    realizedPnLPercent,
    riskRewardRatio,
    holdingTimeMs: now - position.openedAt,
    openedAt: position.openedAt,
    closedAt: now,
  };

  // Update account
  const updatedAccount: PaperTradingAccount = {
    ...account,
    balance: account.balance + realizedPnL,
    buyingPower: account.buyingPower + entryValue, // Return buying power
    equity: account.equity + realizedPnL,
    dayTrades: account.dayTrades + 1,
    isPDT: account.dayTrades + 1 >= 4, // PDT if 4+ day trades
    updatedAt: now,
  };

  return { trade, updatedAccount };
}

// Update position with new price
export function updatePositionPrice(
  position: Position,
  newPrice: number
): Position {
  const { unrealizedPnL, unrealizedPnLPercent } = calculatePositionPnL({
    ...position,
    currentPrice: newPrice,
  });

  return {
    ...position,
    currentPrice: newPrice,
    unrealizedPnL,
    unrealizedPnLPercent,
    updatedAt: Date.now(),
  };
}

// Check stop loss and take profit
export function checkExitConditions(
  position: Position,
  currentPrice: number
): { shouldExit: boolean; reason?: 'stop_loss' | 'take_profit' } {
  if (position.side === 'long') {
    if (position.stopLoss && currentPrice <= position.stopLoss) {
      return { shouldExit: true, reason: 'stop_loss' };
    }
    if (position.takeProfit && currentPrice >= position.takeProfit) {
      return { shouldExit: true, reason: 'take_profit' };
    }
  } else {
    // Short position
    if (position.stopLoss && currentPrice >= position.stopLoss) {
      return { shouldExit: true, reason: 'stop_loss' };
    }
    if (position.takeProfit && currentPrice <= position.takeProfit) {
      return { shouldExit: true, reason: 'take_profit' };
    }
  }

  return { shouldExit: false };
}

// Calculate account statistics from trades
export function calculateAccountStats(trades: Trade[]): AccountStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      averageRR: 0,
      averageHoldingTime: 0,
      maxDrawdown: 0,
      currentStreak: 0,
      bestStreak: 0,
    };
  }

  const winningTrades = trades.filter((t) => t.realizedPnL > 0);
  const losingTrades = trades.filter((t) => t.realizedPnL < 0);

  const totalPnL = trades.reduce((sum, t) => sum + t.realizedPnL, 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.realizedPnL, 0);
  const totalLosses = Math.abs(
    losingTrades.reduce((sum, t) => sum + t.realizedPnL, 0)
  );

  const averageWin =
    winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const averageLoss =
    losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

  const largestWin =
    winningTrades.length > 0
      ? Math.max(...winningTrades.map((t) => t.realizedPnL))
      : 0;
  const largestLoss =
    losingTrades.length > 0
      ? Math.min(...losingTrades.map((t) => t.realizedPnL))
      : 0;

  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  const tradesWithRR = trades.filter((t) => t.riskRewardRatio > 0);
  const averageRR =
    tradesWithRR.length > 0
      ? tradesWithRR.reduce((sum, t) => sum + t.riskRewardRatio, 0) /
        tradesWithRR.length
      : 0;

  const averageHoldingTime =
    trades.reduce((sum, t) => sum + t.holdingTimeMs, 0) / trades.length;

  // Calculate max drawdown
  let peak = DEFAULT_STARTING_BALANCE;
  let maxDrawdown = 0;
  let runningBalance = DEFAULT_STARTING_BALANCE;

  for (const trade of trades) {
    runningBalance += trade.realizedPnL;
    if (runningBalance > peak) {
      peak = runningBalance;
    }
    const drawdown = ((peak - runningBalance) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Calculate streaks
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].realizedPnL > 0) {
      if (i === trades.length - 1) currentStreak++;
      else if (trades[i + 1]?.realizedPnL > 0) currentStreak++;
      else break;
    } else {
      break;
    }
  }

  for (const trade of trades) {
    if (trade.realizedPnL > 0) {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate:
      trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    totalPnL,
    averageWin,
    averageLoss,
    largestWin,
    largestLoss,
    profitFactor,
    averageRR,
    averageHoldingTime,
    maxDrawdown,
    currentStreak,
    bestStreak,
  };
}

// Format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Format percentage
export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

// Format duration
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Position sizing calculator
export function calculatePositionSize(params: {
  accountBalance: number;
  riskPercent: number; // e.g., 1 for 1%
  entryPrice: number;
  stopLoss: number;
}): { shares: number; riskAmount: number; positionValue: number } {
  const riskAmount = params.accountBalance * (params.riskPercent / 100);
  const riskPerShare = Math.abs(params.entryPrice - params.stopLoss);

  if (riskPerShare === 0) {
    return { shares: 0, riskAmount: 0, positionValue: 0 };
  }

  const shares = Math.floor(riskAmount / riskPerShare);
  const positionValue = shares * params.entryPrice;

  return { shares, riskAmount, positionValue };
}

// Option Greeks approximation (simplified)
export function estimateOptionGreeks(params: {
  stockPrice: number;
  strikePrice: number;
  daysToExpiry: number;
  volatility: number; // e.g., 0.3 for 30%
  riskFreeRate: number; // e.g., 0.05 for 5%
  putCall: 'call' | 'put';
}): { delta: number; theta: number; gamma: number; vega: number } {
  // Simplified Black-Scholes approximation
  const T = params.daysToExpiry / 365;
  const moneyness = params.stockPrice / params.strikePrice;

  // Approximate delta
  let delta: number;
  if (params.putCall === 'call') {
    if (moneyness > 1.05) delta = 0.7 + Math.min(0.25, (moneyness - 1.05) * 5);
    else if (moneyness > 0.95) delta = 0.5;
    else delta = 0.3 - Math.min(0.25, (0.95 - moneyness) * 5);
  } else {
    if (moneyness > 1.05) delta = -0.3 + Math.min(0.25, (moneyness - 1.05) * 5);
    else if (moneyness > 0.95) delta = -0.5;
    else delta = -0.7 - Math.min(0.25, (0.95 - moneyness) * 5);
  }

  // Approximate theta (daily decay)
  const theta = -params.stockPrice * params.volatility / (2 * Math.sqrt(T * 365)) * 0.01;

  // Approximate gamma
  const gamma = 0.01 / (params.stockPrice * params.volatility * Math.sqrt(T));

  // Approximate vega (per 1% vol change)
  const vega = params.stockPrice * Math.sqrt(T) * 0.01;

  return { delta, theta, gamma, vega };
}
