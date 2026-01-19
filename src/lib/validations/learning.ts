/**
 * Learning System Zod Validations
 * Canonical schemas for all learning API endpoints
 */
import { z } from 'zod';

// ============================================
// Module Schemas
// ============================================

export const ModuleSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  icon: z.string().max(50).nullable(),
  color: z.string().max(20).nullable(),
  order: z.number().int().min(0),
  lessonsCount: z.number().int().min(0),
  estimatedDuration: z.number().int().min(0), // seconds
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  source: z.enum(['local', 'thinkific', 'database']),
});

export type Module = z.infer<typeof ModuleSchema>;

export const ModulesResponseSchema = z.object({
  modules: z.array(ModuleSchema),
  stats: z.object({
    totalModules: z.number().int(),
    totalLessons: z.number().int(),
    totalHours: z.number(),
  }),
  source: z.enum(['local', 'thinkific', 'database']),
});

export type ModulesResponse = z.infer<typeof ModulesResponseSchema>;

// ============================================
// Lesson Schemas
// ============================================

export const LessonSchema = z.object({
  id: z.string(),
  slug: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  videoId: z.string().nullable(),
  videoUrl: z.string().url().nullable().optional(),
  duration: z.number().int().min(0), // seconds
  transcript: z.string().nullable(),
  keyTakeaways: z.array(z.string()),
  order: z.number().int().min(0),
});

export type Lesson = z.infer<typeof LessonSchema>;

export const ModuleDetailSchema = ModuleSchema.extend({
  lessons: z.array(LessonSchema),
  quizId: z.string().uuid().nullable().optional(),
});

export type ModuleDetail = z.infer<typeof ModuleDetailSchema>;

// ============================================
// Progress Schemas
// ============================================

export const LessonProgressSchema = z.object({
  lessonId: z.string(),
  completed: z.boolean(),
  watchTime: z.number().int().min(0), // seconds
  progressPercent: z.number().int().min(0).max(100),
  completedAt: z.string().datetime().nullable(),
  lastWatchedAt: z.string().datetime().nullable(),
});

export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const ModuleProgressSchema = z.object({
  moduleId: z.string(),
  completed: z.number().int().min(0),
  total: z.number().int().min(0),
  progressPercent: z.number().int().min(0).max(100),
  quizBestScore: z.number().int().min(0).max(100).nullable(),
  completedAt: z.string().datetime().nullable(),
});

export type ModuleProgress = z.infer<typeof ModuleProgressSchema>;

export const ProgressOverviewSchema = z.object({
  overall: z.object({
    completedLessons: z.number().int(),
    totalLessons: z.number().int(),
    progressPercent: z.number().int().min(0).max(100),
  }),
  streak: z.object({
    current: z.number().int().min(0),
    longest: z.number().int().min(0),
    lastActiveDate: z.string().nullable(),
  }),
  modules: z.record(z.string(), z.object({
    completed: z.number().int(),
    total: z.number().int(),
  })),
  recentActivity: z.array(z.object({
    type: z.enum(['lesson_completed', 'quiz_passed', 'module_completed']),
    entityId: z.string(),
    title: z.string(),
    timestamp: z.string().datetime(),
  })).optional(),
  resumeLesson: z.object({
    moduleSlug: z.string(),
    lessonSlug: z.string(),
    lessonTitle: z.string(),
    moduleTitle: z.string(),
  }).nullable().optional(),
});

export type ProgressOverview = z.infer<typeof ProgressOverviewSchema>;

// ============================================
// Progress Update Schemas
// ============================================

export const UpdateLessonProgressSchema = z.object({
  lessonId: z.string().min(1),
  moduleSlug: z.string().min(1).optional(), // For local curriculum lookups
  completed: z.boolean().optional(),
  watchTime: z.number().int().min(0).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
});

export type UpdateLessonProgressInput = z.infer<typeof UpdateLessonProgressSchema>;

// ============================================
// Quiz Schemas
// ============================================

export const QuizOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
});

export const QuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  options: z.array(QuizOptionSchema).min(2),
  explanation: z.string().optional(),
});

export const QuizSchema = z.object({
  id: z.string(),
  moduleId: z.string().nullable(),
  moduleSlug: z.string().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  passingScore: z.number().int().min(0).max(100),
  timeLimit: z.number().int().min(0).nullable(), // seconds
  questions: z.array(QuizQuestionSchema),
});

export type Quiz = z.infer<typeof QuizSchema>;

// Quiz with answers hidden (for fetching)
export const QuizPublicSchema = QuizSchema.extend({
  questions: z.array(QuizQuestionSchema.omit({})), // Options without correct markers
});

export const QuizAnswerSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string(),
});

export const SubmitQuizSchema = z.object({
  answers: z.array(QuizAnswerSchema).min(1),
  timeTaken: z.number().int().min(0).optional(),
});

export type SubmitQuizInput = z.infer<typeof SubmitQuizSchema>;

export const QuizResultSchema = z.object({
  attemptId: z.string(),
  score: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),
  percentage: z.number().int().min(0).max(100),
  passed: z.boolean(),
  timeTaken: z.number().int().nullable(),
  answers: z.array(z.object({
    questionId: z.string(),
    selectedOptionId: z.string(),
    correctOptionId: z.string(),
    isCorrect: z.boolean(),
    explanation: z.string().optional(),
  })),
});

export type QuizResult = z.infer<typeof QuizResultSchema>;

// ============================================
// Error Response Schema
// ============================================

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.record(z.string(), z.array(z.string())).optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
