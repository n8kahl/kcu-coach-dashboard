'use client';

/**
 * User Transcript Modal
 *
 * Displays a user's learning transcript in a scrollable modal.
 * Used by admins to review user progress and compliance data.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  BookOpen,
  Award,
  TrendingUp,
  Target,
  Flame,
  PlayCircle,
  CheckCircle,
  Trophy,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  UserTranscript,
  TranscriptSummary,
  LearningHistoryItem,
  ModuleTimeBreakdown,
} from '@/types/learning';

// ============================================
// TYPES
// ============================================

interface UserTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

// ============================================
// STAT CARD COMPONENT
// ============================================

interface StatItemProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  color: string;
}

function StatItem({ label, value, subValue, icon, color }: StatItemProps) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
      {subValue && (
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subValue}</p>
      )}
    </div>
  );
}

// ============================================
// ACTIVITY ICON
// ============================================

function ActivityIcon({ type }: { type: LearningHistoryItem['activityType'] }) {
  const icons = {
    Video: <PlayCircle className="h-4 w-4 text-blue-400" />,
    Quiz: <Target className="h-4 w-4 text-amber-400" />,
    Lesson: <BookOpen className="h-4 w-4 text-emerald-400" />,
    Practice: <Flame className="h-4 w-4 text-orange-400" />,
    Module: <CheckCircle className="h-4 w-4 text-purple-400" />,
    Course: <Trophy className="h-4 w-4 text-yellow-500" />,
  };
  return icons[type] || <BookOpen className="h-4 w-4 text-gray-400" />;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function UserTranscriptModal({
  isOpen,
  onClose,
  userId,
  userName,
}: UserTranscriptModalProps) {
  const [transcript, setTranscript] = useState<UserTranscript | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalHistory, setTotalHistory] = useState(0);
  const pageSize = 20;

  const fetchTranscript = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = (pageNum - 1) * pageSize;
      const response = await fetch(
        `/api/user/transcript?userId=${userId}&limit=${pageSize}&offset=${offset}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch transcript');
      }

      const data = await response.json();
      setTranscript(data.data);
      setTotalHistory(data.pagination?.total || 0);
    } catch (err) {
      console.error('Error fetching transcript:', err);
      setError('Unable to load transcript. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) {
      setPage(1);
      fetchTranscript(1);
    }
  }, [isOpen, userId, fetchTranscript]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchTranscript(newPage);
  };

  const totalPages = Math.ceil(totalHistory / pageSize);

  if (!isOpen) return null;

  const { summary, history, modules } = transcript || {
    summary: null,
    history: [],
    modules: [],
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Learning Transcript
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {userName}
                {summary?.memberSince && (
                  <span className="text-[var(--text-tertiary)]">
                    {' '}&bull; Member since{' '}
                    {new Date(summary.memberSince).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchTranscript(page)}
                disabled={loading}
                icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
            {loading && !transcript ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
                <span className="ml-2 text-[var(--text-secondary)]">Loading transcript...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-[var(--error)] mb-4">{error}</p>
                <Button variant="primary" onClick={() => fetchTranscript(page)}>
                  Try Again
                </Button>
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <StatItem
                    label="Study Time"
                    value={summary?.totalTimeFormatted || '0m'}
                    subValue={`${summary?.lessonsCompleted || 0} lessons`}
                    icon={<Clock className="h-4 w-4" />}
                    color="#3b82f6"
                  />
                  <StatItem
                    label="Coverage"
                    value={`${summary?.contentCoverage || 0}%`}
                    subValue="of curriculum"
                    icon={<BookOpen className="h-4 w-4" />}
                    color="#22c55e"
                  />
                  <StatItem
                    label="Quiz Grade"
                    value={summary?.averageQuizGrade || 'N/A'}
                    subValue={summary ? `${summary.averageQuizScore}% avg` : undefined}
                    icon={<Award className="h-4 w-4" />}
                    color="#f59e0b"
                  />
                  <StatItem
                    label="Consistency"
                    value={`${summary?.consistencyScore || 0}%`}
                    subValue={summary ? `Rank #${summary.globalRank}` : undefined}
                    icon={<TrendingUp className="h-4 w-4" />}
                    color="#8b5cf6"
                  />
                </div>

                {/* Module Breakdown */}
                {modules && modules.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Time by Module
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {modules.slice(0, 6).map((module) => (
                        <div
                          key={module.moduleId}
                          className="flex items-center justify-between rounded-lg bg-[var(--bg-secondary)] px-3 py-2"
                        >
                          <span className="text-sm text-[var(--text-primary)] truncate">
                            {module.moduleTitle}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--text-tertiary)]">
                              {module.lessonCount} lessons
                            </span>
                            <Badge variant="default" size="sm">
                              {module.totalFormatted}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity History */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Activity History
                    </h3>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {totalHistory} total activities
                    </span>
                  </div>

                  {history && history.length > 0 ? (
                    <>
                      <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[var(--bg-secondary)]">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[var(--text-tertiary)]">
                                Date
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[var(--text-tertiary)]">
                                Activity
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[var(--text-tertiary)]">
                                Details
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[var(--text-tertiary)]">
                                Time
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[var(--text-tertiary)]">
                                Result
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-primary)]">
                            {history.map((item) => (
                              <tr key={item.id} className="hover:bg-[var(--bg-tertiary)]">
                                <td className="px-3 py-2 text-[var(--text-secondary)]">
                                  {item.dateFormatted}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <ActivityIcon type={item.activityType} />
                                    <span className="text-[var(--text-primary)]">
                                      {item.activityType}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-[var(--text-secondary)] max-w-xs truncate">
                                  {item.activityTitle}
                                </td>
                                <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">
                                  {item.timeSpentFormatted}
                                </td>
                                <td className="px-3 py-2">
                                  {item.result ? (
                                    <span
                                      className={`font-medium ${
                                        item.resultType === 'score'
                                          ? parseInt(item.result) >= 90
                                            ? 'text-emerald-400'
                                            : parseInt(item.result) >= 70
                                            ? 'text-amber-400'
                                            : 'text-red-400'
                                          : item.resultType === 'completion'
                                          ? 'text-emerald-400'
                                          : 'text-[var(--text-secondary)]'
                                      }`}
                                    >
                                      {item.result}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-tertiary)]">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <span className="text-xs text-[var(--text-tertiary)]">
                            Page {page} of {totalPages}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePageChange(page - 1)}
                              disabled={page === 1 || loading}
                              icon={<ChevronLeft className="h-4 w-4" />}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePageChange(page + 1)}
                              disabled={page >= totalPages || loading}
                            >
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 border border-[var(--border-primary)] rounded-lg">
                      <BookOpen className="h-8 w-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                      <p className="text-sm text-[var(--text-secondary)]">
                        No learning activity recorded yet
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default UserTranscriptModal;
