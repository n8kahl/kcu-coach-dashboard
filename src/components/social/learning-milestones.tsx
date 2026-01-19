'use client';

/**
 * Learning Milestones Component for Social Builder
 *
 * Displays recent learning achievements and allows generating social content from them.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  BookOpen,
  Clock,
  Trophy,
  Flame,
  Target,
  Zap,
  RefreshCw,
  Plus,
  User,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/feedback';

// ============================================
// TYPES
// ============================================

interface LearningMilestone {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  milestone_type: 'course_complete' | 'module_complete' | 'quiz_passed' | 'hours_milestone' | 'streak_milestone' | 'achievement';
  title: string;
  description: string;
  stats: {
    total_hours?: number;
    quiz_score?: number;
    streak_days?: number;
    modules_completed?: number;
    lessons_completed?: number;
  };
  earned_at: string;
  shareable: boolean;
}

interface LearningMilestonesProps {
  showToast: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string }) => void;
  onRefresh?: () => void;
}

// ============================================
// MILESTONE TYPE CONFIG
// ============================================

const MILESTONE_CONFIG: Record<
  LearningMilestone['milestone_type'],
  { icon: React.ReactNode; color: string; label: string }
> = {
  course_complete: { icon: <Trophy className="w-4 h-4" />, color: '#f59e0b', label: 'Course Complete' },
  module_complete: { icon: <BookOpen className="w-4 h-4" />, color: '#22c55e', label: 'Module Complete' },
  quiz_passed: { icon: <Target className="w-4 h-4" />, color: '#3b82f6', label: 'Quiz Passed' },
  hours_milestone: { icon: <Clock className="w-4 h-4" />, color: '#8b5cf6', label: 'Hours Milestone' },
  streak_milestone: { icon: <Flame className="w-4 h-4" />, color: '#ef4444', label: 'Streak Milestone' },
  achievement: { icon: <Award className="w-4 h-4" />, color: '#f59e0b', label: 'Achievement' },
};

// ============================================
// COMPONENT
// ============================================

export function LearningMilestones({ showToast }: LearningMilestonesProps) {
  const [milestones, setMilestones] = useState<LearningMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Custom content form state
  const [customMilestone, setCustomMilestone] = useState({
    milestone_type: 'hours_milestone' as LearningMilestone['milestone_type'],
    user_name: '',
    total_hours: 50,
    quiz_score: 90,
    streak_days: 7,
    modules_completed: 1,
  });

  // Fetch milestones
  const fetchMilestones = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/social/achievements?limit=20');
      const data = await response.json();

      if (response.ok) {
        setMilestones(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch milestones');
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to load milestones',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  // Generate content from milestone
  const handleGenerateFromMilestone = async (milestone: LearningMilestone) => {
    setGenerating(milestone.id);
    try {
      const response = await fetch('/api/admin/social/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestone_id: milestone.id,
          milestone_type: milestone.milestone_type,
          user_id: milestone.user_id,
          platforms: ['instagram', 'tiktok'],
          custom_stats: {
            ...milestone.stats,
            user_name: milestone.user_name,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: 'Content generated',
          message: 'New social content suggestion created from milestone',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Generation failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setGenerating(null);
    }
  };

  // Generate custom content
  const handleGenerateCustom = async () => {
    setGenerating('custom');
    try {
      const response = await fetch('/api/admin/social/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestone_type: customMilestone.milestone_type,
          platforms: ['instagram', 'tiktok'],
          custom_stats: {
            user_name: customMilestone.user_name || 'A KCU student',
            total_hours: customMilestone.total_hours,
            quiz_score: customMilestone.quiz_score,
            streak_days: customMilestone.streak_days,
            modules_completed: customMilestone.modules_completed,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: 'Content generated',
          message: 'New social content created from custom milestone',
        });
        setShowCustomForm(false);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Generation failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setGenerating(null);
    }
  };

  // Format relative time
  const formatRelativeTime = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Learning Milestones
          </h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Generate social content from student achievements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchMilestones}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCustomForm(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Custom Content
          </Button>
        </div>
      </div>

      {/* Custom Content Form */}
      <AnimatePresence>
        {showCustomForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card variant="bordered" padding="md">
              <CardHeader
                title="Create Custom Learning Content"
                icon={<Zap className="w-5 h-5" />}
                className="mb-4"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Milestone Type
                  </label>
                  <Select
                    value={customMilestone.milestone_type}
                    onChange={(e) =>
                      setCustomMilestone((prev) => ({
                        ...prev,
                        milestone_type: e.target.value as LearningMilestone['milestone_type'],
                      }))
                    }
                    options={[
                      { value: 'hours_milestone', label: 'Hours Milestone' },
                      { value: 'quiz_passed', label: 'Quiz Passed' },
                      { value: 'module_complete', label: 'Module Complete' },
                      { value: 'course_complete', label: 'Course Complete' },
                      { value: 'streak_milestone', label: 'Streak Milestone' },
                      { value: 'achievement', label: 'Achievement' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Student Name (optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="Leave blank for generic"
                    value={customMilestone.user_name}
                    onChange={(e) =>
                      setCustomMilestone((prev) => ({ ...prev, user_name: e.target.value }))
                    }
                  />
                </div>

                {customMilestone.milestone_type === 'hours_milestone' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Total Hours
                    </label>
                    <Input
                      type="number"
                      value={customMilestone.total_hours}
                      onChange={(e) =>
                        setCustomMilestone((prev) => ({
                          ...prev,
                          total_hours: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                )}

                {customMilestone.milestone_type === 'quiz_passed' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Quiz Score (%)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={customMilestone.quiz_score}
                      onChange={(e) =>
                        setCustomMilestone((prev) => ({
                          ...prev,
                          quiz_score: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                )}

                {customMilestone.milestone_type === 'streak_milestone' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Streak Days
                    </label>
                    <Input
                      type="number"
                      value={customMilestone.streak_days}
                      onChange={(e) =>
                        setCustomMilestone((prev) => ({
                          ...prev,
                          streak_days: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                )}

                {(customMilestone.milestone_type === 'module_complete' ||
                  customMilestone.milestone_type === 'course_complete') && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Modules Completed
                    </label>
                    <Input
                      type="number"
                      value={customMilestone.modules_completed}
                      onChange={(e) =>
                        setCustomMilestone((prev) => ({
                          ...prev,
                          modules_completed: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={() => setShowCustomForm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleGenerateCustom}
                  loading={generating === 'custom'}
                >
                  Generate Content
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestones List */}
      {loading ? (
        <LoadingState text="Loading milestones..." />
      ) : milestones.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center">
          <Award className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            No recent milestones
          </h3>
          <p className="text-[var(--text-secondary)] mb-4">
            Learning milestones will appear here as students progress through courses.
          </p>
          <Button variant="primary" onClick={() => setShowCustomForm(true)}>
            Create Custom Content
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {milestones.map((milestone) => {
              const config = MILESTONE_CONFIG[milestone.milestone_type];
              return (
                <motion.div
                  key={milestone.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card variant="default" padding="md" hoverable>
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${config.color}20`, color: config.color }}
                      >
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {milestone.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            size="sm"
                            style={{ backgroundColor: `${config.color}20`, color: config.color }}
                          >
                            {config.label}
                          </Badge>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {formatRelativeTime(milestone.earned_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* User */}
                    <div className="flex items-center gap-2 mb-3 text-sm text-[var(--text-secondary)]">
                      {milestone.user_avatar ? (
                        <img
                          src={milestone.user_avatar}
                          alt={milestone.user_name}
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                      <span>{milestone.user_name}</span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-[var(--text-tertiary)] mb-4 line-clamp-2">
                      {milestone.description}
                    </p>

                    {/* Stats */}
                    {Object.keys(milestone.stats).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {milestone.stats.total_hours && (
                          <Badge variant="default" size="sm">
                            <Clock className="w-3 h-3 mr-1" />
                            {milestone.stats.total_hours}h
                          </Badge>
                        )}
                        {milestone.stats.quiz_score && (
                          <Badge variant="default" size="sm">
                            <Target className="w-3 h-3 mr-1" />
                            {milestone.stats.quiz_score}%
                          </Badge>
                        )}
                        {milestone.stats.streak_days && (
                          <Badge variant="default" size="sm">
                            <Flame className="w-3 h-3 mr-1" />
                            {milestone.stats.streak_days}d
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Action */}
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      onClick={() => handleGenerateFromMilestone(milestone)}
                      loading={generating === milestone.id}
                      icon={<ChevronRight className="w-4 h-4" />}
                    >
                      Generate Social Content
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default LearningMilestones;
