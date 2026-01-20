'use client';

/**
 * ModuleProgressList - Learning Intelligence Dashboard Module Grid
 *
 * A high-impact, responsive grid display of curriculum modules with:
 * - Status badges (Locked, In Progress, Completed, Mastered)
 * - Progress bars with percentages
 * - Dynamic action buttons based on module state
 * - Next.js router navigation
 */

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Lock,
  Play,
  Trophy,
  Star,
  RotateCcw,
  BookOpen,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import type { ModuleProgress as LibModuleProgress } from '@/lib/learning-progress';
import type { CourseModule, ModuleProgress as TypeModuleProgress } from '@/types/learning';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Enhanced module data combining progress with module metadata
 */
export interface EnhancedModuleProgress {
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
  description?: string;
  progress: number; // 0-100
  lessonsCompleted: number;
  totalLessons: number;
  quizScore?: number;
  quizPassed: boolean;
  isLocked?: boolean;
  unlockReason?: string;
  resumeLessonSlug?: string;
  resumeLessonTitle?: string;
  moduleNumber?: number;
  icon?: string;
  color?: string;
}

type ModuleStatus = 'locked' | 'not_started' | 'in_progress' | 'completed' | 'mastered';

interface ModuleProgressListProps {
  /** Array of module progress data */
  modules: EnhancedModuleProgress[] | LibModuleProgress[];
  /** Base course slug for navigation (default: 'kcu-trading-mastery') */
  courseSlug?: string;
  /** Optional class name */
  className?: string;
  /** Show as compact list instead of grid */
  compact?: boolean;
  /** Title for the card header */
  title?: string;
}

// Legacy props for backward compatibility
interface LegacyModuleProgressListProps {
  modules: (CourseModule & { progress: TypeModuleProgress })[];
  courseSlug: string;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Determine module status based on progress and lock state
 */
function getModuleStatus(module: EnhancedModuleProgress): ModuleStatus {
  if (module.isLocked) return 'locked';
  if (module.progress === 0) return 'not_started';
  if (module.progress >= 100 && module.quizPassed) return 'mastered';
  if (module.progress >= 100) return 'completed';
  return 'in_progress';
}

/**
 * Get status badge configuration
 */
function getStatusBadge(status: ModuleStatus): {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'error' | 'gold';
  icon: React.ElementType;
} {
  switch (status) {
    case 'locked':
      return { label: 'Locked', variant: 'default', icon: Lock };
    case 'not_started':
      return { label: 'Start', variant: 'default', icon: BookOpen };
    case 'in_progress':
      return { label: 'In Progress', variant: 'warning', icon: Play };
    case 'completed':
      return { label: 'Completed', variant: 'success', icon: CheckCircle2 };
    case 'mastered':
      return { label: 'Mastered', variant: 'gold', icon: Star };
    default:
      return { label: 'Start', variant: 'default', icon: BookOpen };
  }
}

/**
 * Get status icon for the module card
 */
function getStatusIcon(status: ModuleStatus): React.ElementType {
  switch (status) {
    case 'locked': return Lock;
    case 'completed': return CheckCircle2;
    case 'mastered': return Trophy;
    case 'in_progress': return Play;
    default: return BookOpen;
  }
}

/**
 * Get icon background color based on status
 */
function getIconBgClass(status: ModuleStatus): string {
  switch (status) {
    case 'locked':
      return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]';
    case 'completed':
      return 'bg-[var(--profit)]/20 text-[var(--profit)]';
    case 'mastered':
      return 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]';
    case 'in_progress':
      return 'bg-[var(--warning)]/20 text-[var(--warning)]';
    default:
      return 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]';
  }
}

/**
 * Check if module data is from the legacy format
 */
function isLegacyModule(module: unknown): module is CourseModule & { progress: TypeModuleProgress } {
  return typeof module === 'object' && module !== null && 'title' in module && 'progress' in module && typeof (module as { progress: { completionPercent?: number } }).progress === 'object';
}

/**
 * Normalize module data to EnhancedModuleProgress format
 */
function normalizeModule(
  module: EnhancedModuleProgress | LibModuleProgress | (CourseModule & { progress: TypeModuleProgress })
): EnhancedModuleProgress {
  if (isLegacyModule(module)) {
    // Legacy format from types/learning
    return {
      moduleId: module.id,
      moduleSlug: module.slug,
      moduleName: module.title,
      description: module.description || undefined,
      progress: module.progress.completionPercent,
      lessonsCompleted: module.progress.completedLessons,
      totalLessons: module.progress.totalLessons,
      quizScore: module.progress.bestQuizScore || undefined,
      quizPassed: module.progress.quizPassed,
      isLocked: module.progress.isLocked,
      unlockReason: module.progress.unlockReason,
      moduleNumber: parseInt(module.moduleNumber) || undefined,
    };
  }

  // LibModuleProgress format
  return {
    moduleId: module.moduleId,
    moduleSlug: module.moduleSlug,
    moduleName: module.moduleName,
    progress: module.progress,
    lessonsCompleted: module.lessonsCompleted,
    totalLessons: module.totalLessons,
    quizScore: module.quizScore,
    quizPassed: module.quizPassed,
    isLocked: false,
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface ModuleCardProps {
  module: EnhancedModuleProgress;
  courseSlug: string;
  index: number;
}

function ModuleCard({ module, courseSlug, index }: ModuleCardProps) {
  const router = useRouter();
  const status = getModuleStatus(module);
  const badge = getStatusBadge(status);
  const StatusIcon = getStatusIcon(status);
  const BadgeIcon = badge.icon;

  const handleAction = () => {
    if (status === 'locked') return;

    // Navigate to module or specific lesson
    if (status === 'in_progress' && module.resumeLessonSlug) {
      router.push(`/learn/${courseSlug}/${module.moduleSlug}/${module.resumeLessonSlug}`);
    } else {
      router.push(`/learn/${courseSlug}/${module.moduleSlug}`);
    }
  };

  const getActionButton = () => {
    switch (status) {
      case 'locked':
        return (
          <Button variant="secondary" size="sm" disabled className="w-full opacity-50">
            <Lock className="w-4 h-4 mr-2" />
            Locked
          </Button>
        );
      case 'in_progress':
        return (
          <Button variant="primary" size="sm" onClick={handleAction} className="w-full">
            <Play className="w-4 h-4 mr-2" />
            {module.resumeLessonTitle
              ? `Resume: ${module.resumeLessonTitle.slice(0, 20)}${module.resumeLessonTitle.length > 20 ? '...' : ''}`
              : 'Continue Learning'}
          </Button>
        );
      case 'completed':
        return (
          <Button variant="secondary" size="sm" onClick={handleAction} className="w-full">
            <RotateCcw className="w-4 h-4 mr-2" />
            Review Module
          </Button>
        );
      case 'mastered':
        return (
          <Button variant="secondary" size="sm" onClick={handleAction} className="w-full group">
            <Sparkles className="w-4 h-4 mr-2 text-[var(--accent-primary)] group-hover:animate-pulse" />
            Review Mastery
          </Button>
        );
      default:
        return (
          <Button variant="primary" size="sm" onClick={handleAction} className="w-full">
            <BookOpen className="w-4 h-4 mr-2" />
            Start Module
          </Button>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="h-full"
    >
      <div
        className={cn(
          'h-full flex flex-col p-4 rounded-xl border transition-all duration-200',
          status === 'locked'
            ? 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] opacity-70 cursor-not-allowed'
            : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-[var(--accent-primary)]/50 hover:shadow-lg hover:shadow-[var(--accent-primary)]/5',
          status === 'mastered' && 'border-[var(--accent-primary)]/30 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--accent-primary)]/5'
        )}
      >
        {/* Header: Icon, Title, Badge */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform',
              getIconBgClass(status),
              status !== 'locked' && 'group-hover:scale-105'
            )}
          >
            <StatusIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-[var(--text-primary)] truncate text-sm">
                {module.moduleName}
              </h3>
              <Badge variant={badge.variant} size="sm" className="flex-shrink-0">
                <BadgeIcon className="w-3 h-3 mr-1" />
                {badge.label}
              </Badge>
            </div>
            {module.description && (
              <p className="text-xs text-[var(--text-tertiary)] line-clamp-2">
                {module.description}
              </p>
            )}
          </div>
        </div>

        {/* Progress Section */}
        <div className="mb-4 flex-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[var(--text-tertiary)]">
              {module.lessonsCompleted}/{module.totalLessons} lessons
            </span>
            <span
              className={cn(
                'font-semibold',
                status === 'completed' || status === 'mastered'
                  ? 'text-[var(--profit)]'
                  : 'text-[var(--text-secondary)]'
              )}
            >
              {Math.round(module.progress)}%
            </span>
          </div>
          <ProgressBar
            value={module.progress}
            variant={status === 'mastered' ? 'gold' : status === 'completed' ? 'success' : 'default'}
            size="sm"
          />

          {/* Quiz Score */}
          {module.quizScore !== undefined && (
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              <Trophy
                className={cn(
                  'w-3.5 h-3.5',
                  module.quizPassed ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
                )}
              />
              <span className="text-[var(--text-tertiary)]">
                Quiz: {module.quizScore}%
              </span>
              {module.quizPassed && (
                <CheckCircle2 className="w-3 h-3 text-[var(--profit)]" />
              )}
            </div>
          )}

          {/* Unlock Reason for Locked Modules */}
          {status === 'locked' && module.unlockReason && (
            <p className="mt-2 text-xs text-[var(--text-muted)] italic">
              {module.unlockReason}
            </p>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-auto">
          {getActionButton()}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ModuleProgressList({
  modules,
  courseSlug = 'kcu-trading-mastery',
  className = '',
  compact = false,
  title = 'Curriculum Progress',
}: ModuleProgressListProps | LegacyModuleProgressListProps) {
  // Normalize all modules to EnhancedModuleProgress format
  const normalizedModules = modules.map(normalizeModule);

  // Calculate aggregate stats
  const totalProgress = normalizedModules.length > 0
    ? Math.round(normalizedModules.reduce((sum, m) => sum + m.progress, 0) / normalizedModules.length)
    : 0;
  const completedModules = normalizedModules.filter(m => m.progress >= 100).length;
  const masteredModules = normalizedModules.filter(m => m.progress >= 100 && m.quizPassed).length;

  if (compact) {
    // Compact list view (for smaller spaces)
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{title}</span>
            <span className="text-sm font-normal text-[var(--text-tertiary)]">
              {completedModules}/{normalizedModules.length} complete
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {normalizedModules.map((module, index) => (
            <CompactModuleItem
              key={module.moduleId}
              module={module}
              courseSlug={courseSlug}
              index={index}
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Full grid view
  return (
    <div className={className}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            {completedModules} of {normalizedModules.length} modules complete
            {masteredModules > 0 && ` (${masteredModules} mastered)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-2xl font-bold text-[var(--accent-primary)]">{totalProgress}%</p>
            <p className="text-xs text-[var(--text-tertiary)]">Overall</p>
          </div>
        </div>
      </div>

      {/* Responsive Grid: 1 col mobile, 2 col tablet, 3 col desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {normalizedModules.map((module, index) => (
          <ModuleCard
            key={module.moduleId}
            module={module}
            courseSlug={courseSlug}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// COMPACT MODULE ITEM (for list view)
// ============================================================================

function CompactModuleItem({
  module,
  courseSlug,
  index,
}: {
  module: EnhancedModuleProgress;
  courseSlug: string;
  index: number;
}) {
  const router = useRouter();
  const status = getModuleStatus(module);
  const badge = getStatusBadge(status);
  const StatusIcon = getStatusIcon(status);

  const handleClick = () => {
    if (status === 'locked') return;
    if (status === 'in_progress' && module.resumeLessonSlug) {
      router.push(`/learn/${courseSlug}/${module.moduleSlug}/${module.resumeLessonSlug}`);
    } else {
      router.push(`/learn/${courseSlug}/${module.moduleSlug}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <button
        onClick={handleClick}
        disabled={status === 'locked'}
        className={cn(
          'w-full p-3 rounded-lg border transition-all text-left',
          status === 'locked'
            ? 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] opacity-60 cursor-not-allowed'
            : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-tertiary)]'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', getIconBgClass(status))}>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-primary)] truncate text-sm">
                {module.moduleName}
              </span>
              <Badge variant={badge.variant} size="sm">
                {Math.round(module.progress)}%
              </Badge>
            </div>
            <div className="mt-1">
              <ProgressBar value={module.progress} size="xs" variant={status === 'mastered' ? 'gold' : 'default'} />
            </div>
          </div>
          {status !== 'locked' && (
            <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
          )}
        </div>
      </button>
    </motion.div>
  );
}

export default ModuleProgressList;
