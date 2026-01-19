'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Bot,
  CheckCircle,
  TrendingUp,
  Lightbulb,
  BookOpen,
  Target,
  Clock,
  BarChart2,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AIFeedback {
  positive: string;
  improvement: string;
  specificTip: string;
  ltpConcept: string;
  grade: string;
  score: number;
}

interface AICoachFeedbackProps {
  feedback: AIFeedback;
  relatedLessonSlug?: string;
  onReviewSetup?: () => void;
  onPracticeAnother?: () => void;
  onGoHome?: () => void;
  className?: string;
}

export function AICoachFeedback({
  feedback,
  relatedLessonSlug,
  onReviewSetup,
  onPracticeAnother,
  onGoHome,
  className,
}: AICoachFeedbackProps) {
  const gradeColor =
    feedback.grade === 'A' ? 'text-[var(--profit)]' :
    feedback.grade === 'B' ? 'text-blue-400' :
    feedback.grade === 'C' ? 'text-[var(--warning)]' :
    feedback.grade === 'D' ? 'text-orange-400' :
    'text-[var(--loss)]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-gradient-to-r from-[var(--accent-primary)]/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--accent-primary)]/20 rounded-lg">
              <Bot className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">
                AI Coach Feedback
              </h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                Personalized analysis of your decision
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-1">
              <span className={cn('text-2xl font-bold', gradeColor)}>
                {feedback.score}
              </span>
              <span className="text-sm text-[var(--text-tertiary)]">/100</span>
            </div>
            <span className={cn('text-sm font-bold', gradeColor)}>
              ({feedback.grade})
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* What You Did Well */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 bg-[var(--profit)]/10 border border-[var(--profit)]/30 rounded-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-[var(--profit)]" />
            <h4 className="font-semibold text-[var(--profit)]">
              What You Did Well
            </h4>
          </div>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {feedback.positive}
          </p>
        </motion.div>

        {/* Area for Improvement */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="p-4 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-[var(--warning)]" />
            <h4 className="font-semibold text-[var(--warning)]">
              Area for Improvement
            </h4>
          </div>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {feedback.improvement}
          </p>
        </motion.div>

        {/* Specific Tip */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="p-4 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-5 h-5 text-[var(--accent-primary)]" />
            <h4 className="font-semibold text-[var(--accent-primary)]">
              Tip for Next Time
            </h4>
          </div>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {feedback.specificTip}
          </p>
        </motion.div>

        {/* LTP Concept Reference */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-5 h-5 text-[var(--text-secondary)]" />
            <h4 className="font-semibold text-[var(--text-secondary)]">
              LTP Framework Connection
            </h4>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {feedback.ltpConcept}
          </p>
        </motion.div>

        {/* LTP Quick Reference */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-3 gap-2 text-center"
        >
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
            <Target className="w-5 h-5 mx-auto mb-1 text-blue-400" />
            <p className="text-xs font-semibold text-blue-400">Level</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">Key S/R</p>
          </div>
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
            <BarChart2 className="w-5 h-5 mx-auto mb-1 text-green-400" />
            <p className="text-xs font-semibold text-green-400">Trend</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">EMA Alignment</p>
          </div>
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
            <Clock className="w-5 h-5 mx-auto mb-1 text-purple-400" />
            <p className="text-xs font-semibold text-purple-400">Patience</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">Candle Confirm</p>
          </div>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {onPracticeAnother && (
            <Button
              variant="primary"
              size="sm"
              onClick={onPracticeAnother}
              className="flex-1"
            >
              Practice Another
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {onReviewSetup && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onReviewSetup}
            >
              Review Setup
            </Button>
          )}
          {relatedLessonSlug && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = `/learn/${relatedLessonSlug}`}
            >
              <BookOpen className="w-4 h-4 mr-1" />
              Related Lesson
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default AICoachFeedback;
