'use client';

/**
 * JourneyMap - Premium Timeline Visualization for Course Progress
 *
 * A cinematic, Netflix-style journey map showing module progression with:
 * - Vertical timeline with animated connectors
 * - Frosted glass effects for locked modules
 * - Golden glow for completed modules
 * - Smooth animations and micro-interactions
 */

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Lock,
  Play,
  Trophy,
  Star,
  BookOpen,
  Sparkles,
  ChevronRight,
  Clock,
} from 'lucide-react';
import type { CourseModule, ModuleProgress as TypeModuleProgress } from '@/types/learning';

// ============================================================================
// TYPES
// ============================================================================

interface ModuleWithProgress extends CourseModule {
  progress: TypeModuleProgress;
}

interface JourneyMapProps {
  modules: ModuleWithProgress[];
  courseSlug: string;
  className?: string;
}

type ModuleStatus = 'locked' | 'not_started' | 'in_progress' | 'completed' | 'mastered';

// ============================================================================
// HELPERS
// ============================================================================

function getModuleStatus(module: ModuleWithProgress): ModuleStatus {
  const { progress } = module;
  if (progress.isLocked) return 'locked';
  if (progress.completionPercent === 0) return 'not_started';
  if (progress.completionPercent >= 100 && progress.quizPassed) return 'mastered';
  if (progress.completionPercent >= 100) return 'completed';
  return 'in_progress';
}

function getStatusConfig(status: ModuleStatus) {
  switch (status) {
    case 'locked':
      return {
        icon: Lock,
        label: 'Locked',
        badgeVariant: 'default' as const,
        nodeClass: 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]',
        glowClass: '',
        lineClass: 'bg-[var(--border-primary)]',
      };
    case 'not_started':
      return {
        icon: BookOpen,
        label: 'Start',
        badgeVariant: 'default' as const,
        nodeClass: 'bg-[var(--bg-secondary)] border-[var(--border-secondary)]',
        glowClass: '',
        lineClass: 'bg-[var(--border-primary)]',
      };
    case 'in_progress':
      return {
        icon: Play,
        label: 'In Progress',
        badgeVariant: 'warning' as const,
        nodeClass: 'bg-[var(--warning)]/10 border-[var(--warning)]',
        glowClass: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
        lineClass: 'bg-gradient-to-b from-[var(--warning)] to-[var(--border-primary)]',
      };
    case 'completed':
      return {
        icon: CheckCircle2,
        label: 'Completed',
        badgeVariant: 'success' as const,
        nodeClass: 'bg-[var(--profit)]/10 border-[var(--profit)]',
        glowClass: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
        lineClass: 'bg-[var(--profit)]',
      };
    case 'mastered':
      return {
        icon: Star,
        label: 'Mastered',
        badgeVariant: 'gold' as const,
        nodeClass: 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]',
        glowClass: 'shadow-[0_0_30px_rgba(212,175,55,0.4)]',
        lineClass: 'bg-[var(--accent-primary)]',
      };
  }
}

// ============================================================================
// JOURNEY NODE COMPONENT
// ============================================================================

interface JourneyNodeProps {
  module: ModuleWithProgress;
  courseSlug: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  prevStatus: ModuleStatus | null;
}

function JourneyNode({ module, courseSlug, index, isFirst, isLast, prevStatus }: JourneyNodeProps) {
  const router = useRouter();
  const status = getModuleStatus(module);
  const config = getStatusConfig(status);
  const StatusIcon = config.icon;

  const handleClick = () => {
    if (status === 'locked') return;
    router.push(`/learn/${courseSlug}/${module.slug}`);
  };

  // Determine line color based on previous module's status
  const getLineColor = () => {
    if (!prevStatus) return 'bg-[var(--border-primary)]';
    const prevConfig = getStatusConfig(prevStatus);
    return prevConfig.lineClass;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="relative"
    >
      {/* Connecting Line (above node) */}
      {!isFirst && (
        <motion.div
          className={cn(
            'absolute left-8 -top-8 w-0.5 h-8',
            getLineColor()
          )}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: index * 0.1, duration: 0.3 }}
          style={{ transformOrigin: 'top' }}
        />
      )}

      {/* Main Card */}
      <div
        className={cn(
          'relative flex gap-6 cursor-pointer group',
          status === 'locked' && 'cursor-not-allowed'
        )}
        onClick={handleClick}
      >
        {/* Timeline Node */}
        <div className="flex-shrink-0 relative">
          {/* Node Circle */}
          <motion.div
            className={cn(
              'w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-300',
              config.nodeClass,
              config.glowClass,
              status !== 'locked' && 'group-hover:scale-110'
            )}
            whileHover={status !== 'locked' ? { scale: 1.1 } : undefined}
            whileTap={status !== 'locked' ? { scale: 0.95 } : undefined}
          >
            {status === 'mastered' && (
              <motion.div
                className="absolute inset-0 rounded-2xl"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(212,175,55,0.3)',
                    '0 0 40px rgba(212,175,55,0.5)',
                    '0 0 20px rgba(212,175,55,0.3)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <StatusIcon className={cn(
              'w-7 h-7',
              status === 'locked' ? 'text-[var(--text-muted)]' :
              status === 'mastered' ? 'text-[var(--accent-primary)]' :
              status === 'completed' ? 'text-[var(--profit)]' :
              status === 'in_progress' ? 'text-[var(--warning)]' :
              'text-[var(--text-secondary)]'
            )} />
          </motion.div>
        </div>

        {/* Content Card */}
        <Card
          className={cn(
            'flex-1 transition-all duration-300 overflow-hidden',
            status === 'locked' && 'opacity-60',
            status !== 'locked' && 'hover:border-[var(--accent-primary)]/50 hover:shadow-lg',
            status === 'mastered' && 'border-[var(--accent-primary)]/30 bg-gradient-to-r from-[var(--bg-card)] to-[var(--accent-primary)]/5'
          )}
          style={status === 'locked' ? {
            backdropFilter: 'blur(4px)',
          } : undefined}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Title and Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-[var(--text-tertiary)]">
                    Module {module.moduleNumber}
                  </span>
                  <Badge variant={config.badgeVariant} size="sm">
                    {config.label}
                  </Badge>
                </div>

                <h3 className={cn(
                  'text-lg font-semibold mb-2 transition-colors',
                  status === 'locked' ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]'
                )}>
                  {module.title}
                </h3>

                {module.description && (
                  <p className="text-sm text-[var(--text-tertiary)] line-clamp-2 mb-3">
                    {module.description}
                  </p>
                )}

                {/* Progress Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-tertiary)]">
                      {module.progress.completedLessons}/{module.progress.totalLessons} lessons
                    </span>
                    <span className={cn(
                      'font-semibold',
                      status === 'completed' || status === 'mastered' ? 'text-[var(--profit)]' : 'text-[var(--text-secondary)]'
                    )}>
                      {Math.round(module.progress.completionPercent)}%
                    </span>
                  </div>
                  <ProgressBar
                    value={module.progress.completionPercent}
                    variant={status === 'mastered' ? 'gold' : status === 'completed' ? 'success' : 'default'}
                    size="sm"
                  />
                </div>

                {/* Quiz Score */}
                {module.progress.bestQuizScore !== undefined && module.progress.bestQuizScore > 0 && (
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <Trophy className={cn(
                      'w-4 h-4',
                      module.progress.quizPassed ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
                    )} />
                    <span className="text-[var(--text-tertiary)]">
                      Quiz: {module.progress.bestQuizScore}%
                    </span>
                    {module.progress.quizPassed && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--profit)]" />
                    )}
                  </div>
                )}

                {/* Unlock Reason */}
                {status === 'locked' && module.progress.unlockReason && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-[var(--text-muted)]">
                    <Lock className="w-3.5 h-3.5" />
                    <span className="italic">{module.progress.unlockReason}</span>
                  </div>
                )}
              </div>

              {/* Right: Action Arrow */}
              {status !== 'locked' && (
                <motion.div
                  className="flex-shrink-0 self-center"
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ChevronRight className="w-6 h-6 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)]" />
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connecting Line (below node) */}
      {!isLast && (
        <motion.div
          className={cn(
            'absolute left-8 top-[4.5rem] w-0.5 h-8',
            config.lineClass
          )}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: index * 0.1 + 0.2, duration: 0.3 }}
          style={{ transformOrigin: 'top' }}
        />
      )}
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function JourneyMap({ modules, courseSlug, className }: JourneyMapProps) {
  // Calculate stats
  const completedCount = modules.filter(m => m.progress.completionPercent >= 100).length;
  const masteredCount = modules.filter(m => m.progress.completionPercent >= 100 && m.progress.quizPassed).length;
  const totalProgress = modules.length > 0
    ? Math.round(modules.reduce((sum, m) => sum + m.progress.completionPercent, 0) / modules.length)
    : 0;

  return (
    <div className={cn('space-y-8', className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Your Learning Journey</h2>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            {completedCount} of {modules.length} modules complete
            {masteredCount > 0 && (
              <span className="text-[var(--accent-primary)]"> ({masteredCount} mastered)</span>
            )}
          </p>
        </div>

        {/* Overall Progress Ring */}
        <div className="relative w-16 h-16">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="var(--border-primary)"
              strokeWidth="4"
            />
            <motion.circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 28}
              initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
              animate={{ strokeDashoffset: (1 - totalProgress / 100) * 2 * Math.PI * 28 }}
              transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-[var(--accent-primary)]">{totalProgress}%</span>
          </div>
        </div>
      </div>

      {/* Journey Timeline */}
      <div className="space-y-8 pl-2">
        {modules.map((module, index) => (
          <JourneyNode
            key={module.id}
            module={module}
            courseSlug={courseSlug}
            index={index}
            isFirst={index === 0}
            isLast={index === modules.length - 1}
            prevStatus={index > 0 ? getModuleStatus(modules[index - 1]) : null}
          />
        ))}
      </div>
    </div>
  );
}

export default JourneyMap;
