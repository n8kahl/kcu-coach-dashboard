'use client';

/**
 * Official KCU Learning Transcript
 *
 * A professional, compliance-ready view of the user's learning history.
 * Features: Stats Grid, Data-rich Ledger Table, PDF Download, Social Sharing
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/feedback';
import {
  Clock,
  BookOpen,
  Award,
  TrendingUp,
  Download,
  Share2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Filter,
  Calendar,
  Target,
  Flame,
  Trophy,
  PlayCircle,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type {
  UserTranscript,
  TranscriptSummary,
  LearningHistoryItem,
  ModuleTimeBreakdown,
  UserLearningAchievement,
} from '@/types/learning';
import { StudyStatsCardModal } from '@/components/social/StudyStatsCard';

// ============================================
// STAT CARD COMPONENT
// ============================================

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'gold' | 'purple';
}

function StatCard({ label, value, subValue, icon, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    gold: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  };

  const iconColors = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    gold: 'text-amber-400',
    purple: 'text-purple-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 ${colorClasses[color]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          {subValue && (
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subValue}</p>
          )}
        </div>
        <div className={`rounded-lg bg-[var(--bg-tertiary)] p-2 ${iconColors[color]}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// MODULE BREAKDOWN CARD
// ============================================

interface ModuleBreakdownProps {
  modules: ModuleTimeBreakdown[];
}

function ModuleBreakdown({ modules }: ModuleBreakdownProps) {
  if (modules.length === 0) {
    return (
      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Time by Module
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-tertiary)]">No module data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" />
          Time by Module
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {modules.map((module, index) => (
          <motion.div
            key={module.moduleId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="truncate font-medium text-[var(--text-primary)]">
                {module.moduleTitle}
              </span>
              <span className="ml-2 text-[var(--text-secondary)]">{module.totalFormatted}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${module.percentageOfTotal}%` }}
                transition={{ duration: 0.8, delay: index * 0.05 }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-[var(--text-tertiary)]">
              <span>{module.lessonCount} lessons</span>
              <span>{module.percentageOfTotal}%</span>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================
// LEDGER TABLE COMPONENT
// ============================================

interface LedgerTableProps {
  data: LearningHistoryItem[];
  loading?: boolean;
}

function LedgerTable({ data, loading }: LedgerTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns: ColumnDef<LearningHistoryItem>[] = useMemo(
    () => [
      {
        accessorKey: 'dateFormatted',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-[var(--text-primary)]"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <Calendar className="h-3.5 w-3.5" />
            Date
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)]">{row.original.dateFormatted}</span>
        ),
      },
      {
        accessorKey: 'module',
        header: 'Module',
        cell: ({ row }) => (
          <span className="font-medium text-[var(--text-primary)]">{row.original.module}</span>
        ),
      },
      {
        accessorKey: 'activityType',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-[var(--text-primary)]"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Activity
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const type = row.original.activityType;
          const icons = {
            Video: <PlayCircle className="h-4 w-4 text-blue-400" />,
            Quiz: <Target className="h-4 w-4 text-amber-400" />,
            Lesson: <BookOpen className="h-4 w-4 text-emerald-400" />,
            Practice: <Flame className="h-4 w-4 text-orange-400" />,
            Module: <CheckCircle className="h-4 w-4 text-purple-400" />,
            Course: <Trophy className="h-4 w-4 text-gold" />,
          };
          return (
            <div className="flex items-center gap-2">
              {icons[type]}
              <span>{type}</span>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: 'activityTitle',
        header: 'Details',
        cell: ({ row }) => (
          <span className="text-sm text-[var(--text-secondary)]">
            {row.original.activityTitle}
          </span>
        ),
      },
      {
        accessorKey: 'timeSpent',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-[var(--text-primary)]"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <Clock className="h-3.5 w-3.5" />
            Time
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.timeSpentFormatted}</span>
        ),
      },
      {
        accessorKey: 'result',
        header: 'Result',
        cell: ({ row }) => {
          const result = row.original.result;
          const resultType = row.original.resultType;
          if (!result) return <span className="text-[var(--text-tertiary)]">-</span>;

          let colorClass = 'text-[var(--text-secondary)]';
          if (resultType === 'score') {
            const scoreMatch = result.match(/(\d+)/);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
            if (score >= 90) colorClass = 'text-emerald-400';
            else if (score >= 70) colorClass = 'text-amber-400';
            else colorClass = 'text-red-400';
          } else if (resultType === 'completion') {
            colorClass = 'text-emerald-400';
          }

          return <span className={`font-medium ${colorClass}`}>{result}</span>;
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  });

  const activityTypes = ['Video', 'Quiz', 'Lesson', 'Practice', 'Module', 'Course'];

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Learning Ledger
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {/* Activity Type Filter */}
            <div className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              <select
                className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    table.getColumn('activityType')?.setFilterValue(undefined);
                  } else {
                    table.getColumn('activityType')?.setFilterValue([value]);
                  }
                }}
              >
                <option value="all">All Activities</option>
                {activityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            {/* Quick Filters */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.getColumn('activityType')?.setFilterValue(['Quiz'])}
              className="text-xs"
            >
              Quizzes Only
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.getColumn('activityType')?.setFilterValue(['Video'])}
              className="text-xs"
            >
              Videos Only
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-[var(--bg-tertiary)]" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-[var(--text-tertiary)]" />
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              No learning activity recorded yet.
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              Start watching videos or taking quizzes to build your transcript.
            </p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-[var(--border-primary)]">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--border-primary)] transition-colors hover:bg-[var(--bg-tertiary)]"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-[var(--text-tertiary)]">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}{' '}
                of {table.getFilteredRowModel().rows.length} entries
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-sm text-[var(--text-secondary)]">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function TranscriptPage() {
  const router = useRouter();
  const [transcript, setTranscript] = useState<UserTranscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const fetchTranscript = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/transcript?limit=500');

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch transcript');
      }

      const data = await response.json();
      setTranscript(data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching transcript:', err);
      setError('Unable to load your learning transcript. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    alert('PDF download coming soon!');
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  if (loading) {
    return (
      <>
        <Header
          title="Official KCU Learning Transcript"
          subtitle="Your verified learning record"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Profile' }, { label: 'Transcript' }]}
        />
        <PageShell>
          <PageSection>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} className="h-24" />
              ))}
            </div>
          </PageSection>
          <PageSection>
            <SkeletonCard className="h-96" />
          </PageSection>
        </PageShell>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header
          title="Official KCU Learning Transcript"
          subtitle="Your verified learning record"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Profile' }, { label: 'Transcript' }]}
        />
        <PageShell>
          <Card variant="bordered">
            <CardContent className="py-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-[var(--error)]" />
              <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
                Unable to Load Transcript
              </h3>
              <p className="mb-4 text-sm text-[var(--text-tertiary)]">{error}</p>
              <Button variant="primary" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  const { summary, history, modules } = transcript || {
    summary: null,
    history: [],
    modules: [],
  };

  // Format member since date
  const memberSinceFormatted = summary?.memberSince
    ? new Date(summary.memberSince).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Unknown';

  return (
    <>
      <Header
        title="Official KCU Learning Transcript"
        subtitle={`${transcript?.userName || 'Member'} • Since ${memberSinceFormatted}`}
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Profile' }, { label: 'Transcript' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownloadPDF}
            >
              Download PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Share2 className="h-4 w-4" />}
              onClick={handleShare}
            >
              Share Stats
            </Button>
          </div>
        }
      />

      <PageShell>
        {/* Stats Grid */}
        <PageSection>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Study Time"
              value={summary?.totalTimeFormatted || '0m'}
              subValue={summary ? `${summary.lessonsCompleted} lessons completed` : undefined}
              icon={<Clock className="h-5 w-5" />}
              color="blue"
            />
            <StatCard
              label="Content Coverage"
              value={`${summary?.contentCoverage || 0}%`}
              subValue="of Core Curriculum"
              icon={<BookOpen className="h-5 w-5" />}
              color="green"
            />
            <StatCard
              label="Average Quiz Score"
              value={summary?.averageQuizGrade || 'N/A'}
              subValue={summary ? `${summary.averageQuizScore}% average` : undefined}
              icon={<Award className="h-5 w-5" />}
              color="gold"
            />
            <StatCard
              label="Consistency Score"
              value={`${summary?.consistencyScore || 0}%`}
              subValue={summary ? `Rank #${summary.globalRank}` : undefined}
              icon={<TrendingUp className="h-5 w-5" />}
              color="purple"
            />
          </div>
        </PageSection>

        {/* Main Content */}
        <PageSection>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Ledger Table */}
            <div className="lg:col-span-2">
              <LedgerTable data={history} loading={loading} />
            </div>

            {/* Module Breakdown */}
            <div>
              <ModuleBreakdown modules={modules} />
            </div>
          </div>
        </PageSection>
      </PageShell>

      {/* Share Modal */}
      {summary && (
        <StudyStatsCardModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          summary={summary}
          userName={transcript?.userName || 'Member'}
        />
      )}
    </>
  );
}
