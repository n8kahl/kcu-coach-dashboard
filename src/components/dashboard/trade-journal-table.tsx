'use client';

import { useState } from 'react';
import { cn, formatCurrency, formatPercent, formatDateTime } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Filter,
  Download,
  Share2,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import type { TradeEntry } from '@/types';

// Helper to derive display fields from TradeEntry
function getTradeDisplay(trade: TradeEntry) {
  const ltpScore = trade.ltp_score;
  const overallScore = ltpScore?.overall ?? 0;

  // Calculate LTP grade from overall score
  const getLTPGrade = (score: number): string => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  return {
    // Options fields
    isOptions: trade.contract_type === 'call' || trade.contract_type === 'put',
    optionType: trade.contract_type,
    expiration: trade.expiration_date,

    // LTP fields
    ltpGrade: getLTPGrade(overallScore),
    hadLevel: (ltpScore?.level ?? 0) >= 70,
    hadTrend: (ltpScore?.trend ?? 0) >= 70,
    hadPatience: (ltpScore?.patience ?? 0) >= 70,

    // Notes fields - map to existing fields
    setupNotes: trade.notes,
    exitNotes: trade.lessons,
    emotionsList: trade.emotions?.join(', ') || null,

    // Safe access for optional numeric fields
    pnl: trade.pnl ?? 0,
    pnlPercent: trade.pnl_percent ?? 0,
    exitPrice: trade.exit_price,
  };
}

interface TradeJournalTableProps {
  trades: TradeEntry[];
  onSelectTrade?: (trade: TradeEntry) => void;
  onShareTrade?: (trade: TradeEntry) => void;
}

export function TradeJournalTable({
  trades,
  onSelectTrade,
  onShareTrade,
}: TradeJournalTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('entry_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedTrades = [...trades].sort((a, b) => {
    const aVal = a[sortColumn as keyof TradeEntry];
    const bVal = b[sortColumn as keyof TradeEntry];
    if (aVal === undefined || bVal === undefined) return 0;
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getLTPGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'text-[var(--accent-primary)]';
      case 'B':
        return 'text-[var(--profit)]';
      case 'C':
        return 'text-[var(--warning)]';
      case 'D':
      case 'F':
        return 'text-[var(--loss)]';
      default:
        return 'text-[var(--text-secondary)]';
    }
  };

  return (
    <Card>
      <CardHeader
        title="Trade Journal"
        subtitle={`${trades.length} trades`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<Filter className="w-4 h-4" />}>
              Filter
            </Button>
            <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />}>
              Export
            </Button>
          </div>
        }
      />
      <Table>
        <TableHeader>
          <TableRow hoverable={false}>
            <TableHead
              sortable
              sorted={sortColumn === 'entry_time' ? sortDirection : null}
              onClick={() => handleSort('entry_time')}
            >
              Date
            </TableHead>
            <TableHead
              sortable
              sorted={sortColumn === 'symbol' ? sortDirection : null}
              onClick={() => handleSort('symbol')}
            >
              Symbol
            </TableHead>
            <TableHead>Direction</TableHead>
            <TableHead
              sortable
              sorted={sortColumn === 'pnl' ? sortDirection : null}
              onClick={() => handleSort('pnl')}
            >
              P&L
            </TableHead>
            <TableHead
              sortable
              sorted={sortColumn === 'pnl_percent' ? sortDirection : null}
              onClick={() => handleSort('pnl_percent')}
            >
              %
            </TableHead>
            <TableHead
              sortable
              sorted={sortColumn === 'ltp_grade' ? sortDirection : null}
              onClick={() => handleSort('ltp_grade')}
            >
              LTP
            </TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTrades.map((trade) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              isExpanded={expandedId === trade.id}
              onToggle={() => setExpandedId(expandedId === trade.id ? null : trade.id)}
              onShare={onShareTrade}
              getLTPGradeColor={getLTPGradeColor}
            />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

interface TradeRowProps {
  trade: TradeEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onShare?: (trade: TradeEntry) => void;
  getLTPGradeColor: (grade: string) => string;
}

function TradeRow({
  trade,
  isExpanded,
  onToggle,
  onShare,
  getLTPGradeColor,
}: TradeRowProps) {
  const display = getTradeDisplay(trade);

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
      >
        <TableCell mono>
          <div className="flex flex-col">
            <span>{formatDateTime(trade.entry_time).split(' ')[0]}</span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {formatDateTime(trade.entry_time).split(' ').slice(1).join(' ')}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{trade.symbol}</span>
            {display.isOptions && (
              <Badge variant="gold" size="sm">
                {display.optionType?.toUpperCase()}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            {trade.direction === 'long' ? (
              <TrendingUp className="w-4 h-4 text-[var(--profit)]" />
            ) : (
              <TrendingDown className="w-4 h-4 text-[var(--loss)]" />
            )}
            <span className={cn(
              'text-xs font-medium uppercase',
              trade.direction === 'long' ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
            )}>
              {trade.direction}
            </span>
          </div>
        </TableCell>
        <TableCell mono>
          <span className={cn(
            'font-semibold',
            display.pnl >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
          )}>
            {formatCurrency(display.pnl)}
          </span>
        </TableCell>
        <TableCell mono>
          <span className={cn(
            display.pnlPercent >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
          )}>
            {formatPercent(display.pnlPercent)}
          </span>
        </TableCell>
        <TableCell>
          <span className={cn('text-lg font-bold', getLTPGradeColor(display.ltpGrade))}>
            {display.ltpGrade}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {display.pnl > 0 && onShare && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(trade);
                }}
                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
            <button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={7} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-4 bg-[var(--bg-tertiary)] border-y border-[var(--border-primary)]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {/* Entry/Exit */}
                    <div>
                      <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">Entry → Exit</p>
                      <p className="text-sm font-mono">
                        {formatCurrency(trade.entry_price)} → {display.exitPrice ? formatCurrency(display.exitPrice) : '—'}
                      </p>
                    </div>

                    {/* Quantity */}
                    <div>
                      <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">Quantity</p>
                      <p className="text-sm">{trade.quantity}</p>
                    </div>

                    {/* LTP Compliance */}
                    <div>
                      <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">LTP Compliance</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={display.hadLevel ? 'success' : 'default'} size="sm">
                          L {display.hadLevel ? '✓' : '✗'}
                        </Badge>
                        <Badge variant={display.hadTrend ? 'success' : 'default'} size="sm">
                          T {display.hadTrend ? '✓' : '✗'}
                        </Badge>
                        <Badge variant={display.hadPatience ? 'success' : 'default'} size="sm">
                          P {display.hadPatience ? '✓' : '✗'}
                        </Badge>
                      </div>
                    </div>

                    {/* Options Details */}
                    {display.isOptions && (
                      <div>
                        <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">Options</p>
                        <p className="text-sm">
                          {trade.strike_price} {display.optionType?.toUpperCase()} {display.expiration}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {(display.setupNotes || display.exitNotes || display.emotionsList) && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-primary)] grid grid-cols-1 md:grid-cols-3 gap-4">
                      {display.setupNotes && (
                        <div>
                          <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">Setup Notes</p>
                          <p className="text-sm text-[var(--text-secondary)]">{display.setupNotes}</p>
                        </div>
                      )}
                      {display.exitNotes && (
                        <div>
                          <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">Lessons Learned</p>
                          <p className="text-sm text-[var(--text-secondary)]">{display.exitNotes}</p>
                        </div>
                      )}
                      {display.emotionsList && (
                        <div>
                          <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">Emotions</p>
                          <p className="text-sm text-[var(--text-secondary)]">{display.emotionsList}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}
