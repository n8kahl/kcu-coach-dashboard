'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Stat, StatGrid } from '@/components/ui/stat';
import { useToast } from '@/components/ui/toast';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';
import {
  Search,
  Filter,
  Download,
  FileText,
  MessageSquare,
  Bell,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  CheckCircle,
  Eye,
} from 'lucide-react';

interface Trace {
  id: string;
  _table: 'coaching' | 'alert';
  trace_type: string;
  user_id?: string | null;
  triggered_by?: string | null;
  symbol: string | null;
  timeframe: string | null;
  input_snapshot: Record<string, unknown>;
  score_explanation: Record<string, unknown> | null;
  ai_response?: Record<string, unknown>;
  alert_content?: Record<string, unknown>;
  used_fallback?: boolean;
  tokens_used?: { input: number; output: number } | null;
  latency_ms?: number | null;
  created_at: string;
}

interface Stats {
  coachingTotal: number;
  coachingToday: number;
  coachingFallbackRate: number;
  alertsTotal: number;
  alertsToday: number;
}

interface Pagination {
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export default function TracesPage() {
  const { showToast } = useToast();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    hasMore: false,
    limit: 50,
    offset: 0,
  });

  // Filters
  const [tableFilter, setTableFilter] = useState<'all' | 'coaching' | 'alert'>('all');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [fallbackFilter, setFallbackFilter] = useState<boolean | undefined>(undefined);

  // Modal
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/traces?stats=true');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchTraces = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        table: tableFilter,
        limit: '50',
        offset: String(offset),
      });

      if (symbolFilter) params.set('symbol', symbolFilter.toUpperCase());
      if (dateFilter) params.set('startDate', dateFilter);
      if (fallbackFilter !== undefined) params.set('usedFallback', String(fallbackFilter));

      const res = await fetch(`/api/admin/traces?${params}`);
      if (!res.ok) throw new Error('Failed to fetch traces');

      const data = await res.json();
      setTraces(data.traces);
      setPagination(data.pagination);
    } catch (err) {
      showToast({
        title: 'Error',
        message: 'Failed to load traces',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [tableFilter, symbolFilter, dateFilter, fallbackFilter, showToast]);

  useEffect(() => {
    fetchStats();
    fetchTraces(0);
  }, [fetchStats, fetchTraces]);

  const handleExport = async (trace: Trace) => {
    try {
      const res = await fetch(
        `/api/admin/traces?id=${trace.id}&table=${trace._table}&export=true`
      );
      if (!res.ok) throw new Error('Export failed');

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trace-${trace.id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast({ title: 'Exported', message: 'Trace downloaded as JSON', type: 'success' });
    } catch (err) {
      showToast({ title: 'Error', message: 'Failed to export trace', type: 'error' });
    }
  };

  const getTraceTypeBadge = (trace: Trace) => {
    if (trace._table === 'coaching') {
      return (
        <Badge variant="info" className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {trace.trace_type}
        </Badge>
      );
    }
    return (
      <Badge variant="warning" className="flex items-center gap-1">
        <Bell className="h-3 w-3" />
        {trace.trace_type}
      </Badge>
    );
  };

  const getGradeBadge = (trace: Trace) => {
    const explanation = trace.score_explanation;
    if (!explanation) return <span className="text-gray-400">-</span>;

    const grade = (explanation as { grade?: string }).grade;
    if (!grade) return <span className="text-gray-400">-</span>;

    const gradeColors: Record<string, string> = {
      A: 'bg-green-500/20 text-green-400',
      B: 'bg-blue-500/20 text-blue-400',
      C: 'bg-yellow-500/20 text-yellow-400',
      D: 'bg-orange-500/20 text-orange-400',
      F: 'bg-red-500/20 text-red-400',
      Sniper: 'bg-green-500/20 text-green-400',
      Decent: 'bg-yellow-500/20 text-yellow-400',
      'Dumb Shit': 'bg-red-500/20 text-red-400',
    };

    return (
      <Badge className={gradeColors[grade] || 'bg-gray-500/20 text-gray-400'}>
        {grade}
      </Badge>
    );
  };

  return (
    <>
      <Header title="Evidence Traces" subtitle="Audit trail for coaching and alerts" />
      <PageShell>
        {/* Stats */}
        <PageSection>
          <StatGrid>
            <Stat
              label="Coaching Traces"
              value={stats?.coachingTotal.toLocaleString() || '-'}
              changeLabel={`${stats?.coachingToday || 0} today`}
              icon={<MessageSquare className="h-5 w-5" />}
            />
            <Stat
              label="Fallback Rate"
              value={stats ? `${stats.coachingFallbackRate}%` : '-'}
              changeLabel="AI validation failures"
              icon={<AlertTriangle className="h-5 w-5" />}
              change={stats && stats.coachingFallbackRate > 1 ? -1 : 0}
            />
            <Stat
              label="Alert Traces"
              value={stats?.alertsTotal.toLocaleString() || '-'}
              changeLabel={`${stats?.alertsToday || 0} today`}
              icon={<Bell className="h-5 w-5" />}
            />
          </StatGrid>
        </PageSection>

        {/* Filters */}
        <PageSection>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">Filters</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTableFilter('all');
                    setSymbolFilter('');
                    setDateFilter('');
                    setFallbackFilter(undefined);
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex gap-2">
                  {(['all', 'coaching', 'alert'] as const).map((t) => (
                    <Button
                      key={t}
                      variant={tableFilter === t ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setTableFilter(t)}
                    >
                      {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Symbol..."
                    value={symbolFilter}
                    onChange={(e) => setSymbolFilter(e.target.value)}
                    className="pl-9 w-32"
                  />
                </div>

                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-40"
                />

                <div className="flex gap-2">
                  <Button
                    variant={fallbackFilter === true ? 'danger' : 'secondary'}
                    size="sm"
                    onClick={() =>
                      setFallbackFilter(fallbackFilter === true ? undefined : true)
                    }
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Fallbacks
                  </Button>
                </div>

                <Button onClick={() => fetchTraces(0)} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        </PageSection>

        {/* Traces Table */}
        <PageSection>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                        Loading traces...
                      </TableCell>
                    </TableRow>
                  ) : traces.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                        No traces found
                      </TableCell>
                    </TableRow>
                  ) : (
                    traces.map((trace) => (
                      <TableRow key={trace.id}>
                        <TableCell className="font-mono text-xs text-gray-400">
                          {trace.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>{getTraceTypeBadge(trace)}</TableCell>
                        <TableCell>
                          {trace.symbol ? (
                            <Badge variant="primary">{trace.symbol}</Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getGradeBadge(trace)}</TableCell>
                        <TableCell>
                          {trace.used_fallback ? (
                            <Badge variant="error" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              Fallback
                            </Badge>
                          ) : (
                            <Badge
                              variant="success"
                              className="flex items-center gap-1 w-fit bg-green-500/20 text-green-400"
                            >
                              <CheckCircle className="h-3 w-3" />
                              OK
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-400">
                          {formatDateTime(trace.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedTrace(trace)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExport(trace)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>

            {/* Pagination */}
            {pagination.total > 0 && (
              <div className="flex items-center justify-between p-4 border-t border-white/10">
                <span className="text-sm text-gray-400">
                  Showing {pagination.offset + 1}-
                  {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
                  {pagination.total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => fetchTraces(Math.max(0, pagination.offset - pagination.limit))}
                    disabled={pagination.offset === 0 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => fetchTraces(pagination.offset + pagination.limit)}
                    disabled={!pagination.hasMore || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </PageSection>

        {/* Detail Modal */}
        {selectedTrace && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-400" />
                    <span className="font-medium">Trace Details</span>
                    <Badge variant="primary" className="font-mono">
                      {selectedTrace.id.slice(0, 8)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleExport(selectedTrace)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export JSON
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTrace(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs text-gray-400">Type</span>
                    <div className="mt-1">{getTraceTypeBadge(selectedTrace)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Symbol</span>
                    <div className="mt-1 font-mono">
                      {selectedTrace.symbol || '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Grade</span>
                    <div className="mt-1">{getGradeBadge(selectedTrace)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Status</span>
                    <div className="mt-1">
                      {selectedTrace.used_fallback ? (
                        <Badge variant="error">Fallback Used</Badge>
                      ) : (
                        <Badge className="bg-green-500/20 text-green-400">Valid</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Input Snapshot */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span className="text-blue-400">Input Snapshot</span>
                  </h4>
                  <pre className="bg-black/30 rounded-lg p-4 text-xs overflow-x-auto max-h-48">
                    {JSON.stringify(selectedTrace.input_snapshot, null, 2)}
                  </pre>
                </div>

                {/* Score Explanation */}
                {selectedTrace.score_explanation && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <span className="text-green-400">Score Explanation</span>
                      <span className="text-xs text-gray-400">(Deterministic)</span>
                    </h4>
                    <pre className="bg-black/30 rounded-lg p-4 text-xs overflow-x-auto max-h-48">
                      {JSON.stringify(selectedTrace.score_explanation, null, 2)}
                    </pre>
                  </div>
                )}

                {/* AI Response */}
                {selectedTrace.ai_response && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <span className="text-purple-400">AI Response</span>
                      {selectedTrace.tokens_used && (
                        <span className="text-xs text-gray-400">
                          ({selectedTrace.tokens_used.input} in / {selectedTrace.tokens_used.output} out tokens)
                        </span>
                      )}
                    </h4>
                    <pre className="bg-black/30 rounded-lg p-4 text-xs overflow-x-auto max-h-48">
                      {JSON.stringify(selectedTrace.ai_response, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Alert Content */}
                {selectedTrace.alert_content && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <span className="text-yellow-400">Alert Content</span>
                    </h4>
                    <pre className="bg-black/30 rounded-lg p-4 text-xs overflow-x-auto max-h-48">
                      {JSON.stringify(selectedTrace.alert_content, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-xs text-gray-400 pt-4 border-t border-white/10">
                  Created: {formatDateTime(selectedTrace.created_at)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </PageShell>
    </>
  );
}
