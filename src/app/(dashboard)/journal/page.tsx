'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Search,
  ChevronRight,
} from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Trade {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  setupType: string;
  entryTime: string;
  exitTime: string;
  emotions: string[];
  notes?: string;
}

export default function JournalPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDirection, setFilterDirection] = useState<'all' | 'long' | 'short'>('all');

  // Mock data
  const trades: Trade[] = [
    {
      id: '1',
      symbol: 'SPY',
      direction: 'long',
      entryPrice: 450.25,
      exitPrice: 452.80,
      quantity: 100,
      pnl: 255,
      pnlPercent: 0.57,
      setupType: 'LTP',
      entryTime: '2024-01-15T10:30:00',
      exitTime: '2024-01-15T14:45:00',
      emotions: ['confident', 'patient'],
      notes: 'Clean LTP setup at the 21 EMA bounce. Waited for patience candles.',
    },
    {
      id: '2',
      symbol: 'TSLA',
      direction: 'short',
      entryPrice: 245.50,
      exitPrice: 248.20,
      quantity: 50,
      pnl: -135,
      pnlPercent: -1.1,
      setupType: 'VWAP',
      entryTime: '2024-01-15T11:15:00',
      exitTime: '2024-01-15T12:30:00',
      emotions: ['anxious', 'fomo'],
      notes: 'Entered too early without confirmation. FOMO trade.',
    },
    {
      id: '3',
      symbol: 'NVDA',
      direction: 'long',
      entryPrice: 520.00,
      exitPrice: 535.50,
      quantity: 20,
      pnl: 310,
      pnlPercent: 2.98,
      setupType: 'ORB',
      entryTime: '2024-01-14T09:45:00',
      exitTime: '2024-01-14T15:30:00',
      emotions: ['confident'],
      notes: 'ORB breakout with strong volume. Held through pullback.',
    },
  ];

  const stats = {
    totalTrades: trades.length,
    winRate: Math.round((trades.filter(t => t.pnl > 0).length / trades.length) * 100),
    totalPnL: trades.reduce((sum, t) => sum + t.pnl, 0),
    avgWin: trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / trades.filter(t => t.pnl > 0).length || 0,
    avgLoss: trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / trades.filter(t => t.pnl < 0).length || 0,
  };

  const filteredTrades = trades.filter((trade) => {
    const matchesSearch = trade.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trade.setupType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDirection = filterDirection === 'all' || trade.direction === filterDirection;
    return matchesSearch && matchesDirection;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary-400" />
            Trade Journal
          </h1>
          <p className="text-gray-400">Track, analyze, and learn from your trades</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Log Trade
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatBox label="Total Trades" value={stats.totalTrades.toString()} />
        <StatBox
          label="Win Rate"
          value={`${stats.winRate}%`}
          className={stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}
        />
        <StatBox
          label="Total P&L"
          value={formatCurrency(stats.totalPnL)}
          className={stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <StatBox label="Avg Win" value={formatCurrency(stats.avgWin)} className="text-green-400" />
        <StatBox label="Avg Loss" value={formatCurrency(stats.avgLoss)} className="text-red-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by symbol or setup..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 input-field"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value as 'all' | 'long' | 'short')}
            className="px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-gray-100"
          >
            <option value="all">All Directions</option>
            <option value="long">Long Only</option>
            <option value="short">Short Only</option>
          </select>
        </div>
      </div>

      {/* Trades List */}
      <div className="space-y-4">
        {filteredTrades.map((trade) => (
          <Link key={trade.id} href={`/journal/${trade.id}`}>
            <div className="glass-card-hover p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    trade.direction === 'long' ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {trade.direction === 'long' ? (
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{trade.symbol}</span>
                      <Badge variant={trade.direction === 'long' ? 'long' : 'short'}>
                        {trade.direction.toUpperCase()}
                      </Badge>
                      <Badge variant="info">{trade.setupType}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(trade.entryTime)}
                      </span>
                      <span>
                        {formatCurrency(trade.entryPrice)} → {formatCurrency(trade.exitPrice)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`font-semibold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                    </p>
                    <p className={`text-sm ${trade.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
              </div>
              {trade.notes && (
                <p className="mt-3 pt-3 border-t border-dark-border text-sm text-gray-400 line-clamp-1">
                  {trade.notes}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {filteredTrades.length === 0 && (
        <div className="glass-card p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No trades found</h3>
          <p className="text-gray-400 mb-4">
            {searchQuery ? 'Try adjusting your search or filters' : 'Start logging your trades to build your journal'}
          </p>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Log Your First Trade
          </Button>
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  className = 'text-white',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="glass-card p-4 text-center">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${className}`}>{value}</p>
    </div>
  );
}
