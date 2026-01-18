// Learning System Types with Compliance Support

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  isGated: boolean;
  sortOrder: number;
  version: string;
  complianceRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  description: string | null;
  moduleNumber: string;
  thumbnailUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
  unlockAfterModuleId: string | null;
  unlockAfterDays: number | null;
  requiresQuizPass: boolean;
  minQuizScore: number;
  isRequired: boolean;
  createdAt: string;
}

export interface CourseLesson {
  id: string;
  moduleId: string;
  title: string;
  slug: string;
  description: string | null;
  lessonNumber: string;
  videoUrl: string | null;
  videoUid: string | null;
  videoDurationSeconds: number | null;
  thumbnailUrl: string | null;
  transcriptUrl: string | null;
  transcriptText: string | null;
  sortOrder: number;
  isPreview: boolean;
  isPublished: boolean;
  isRequired: boolean;
  minWatchPercent: number;
  allowSkip: boolean;
  createdAt: string;
}

export interface LessonProgress {
  id: string;
  lessonId: string;
  progressSeconds: number;
  progressPercent: number;
  completed: boolean;
  completedAt: string | null;
  totalWatchTimeSeconds: number;
  uniqueWatchTimeSeconds: number;
  watchCount: number;
  pauseCount: number;
  seekCount: number;
  playbackSpeedChanges: number;
  lastPlaybackSpeed: number;
  firstWatchedAt: string | null;
  lastWatchedAt: string;
}

export interface WatchSession {
  id: string;
  lessonId: string;
  startedAt: string;
  endedAt: string | null;
  startPositionSeconds: number;
  endPositionSeconds: number;
  watchDurationSeconds: number;
  playbackSpeed: number;
  wasCompleted: boolean;
  deviceType: string | null;
  browser: string | null;
}

export interface QuizQuestion {
  id: string;
  moduleId: string;
  lessonId: string | null;
  questionType: 'single' | 'multiple' | 'true_false';
  questionText: string;
  explanation: string | null;
  remediationVideoId: string | null;
  remediationTimestampSeconds: number | null;
  sortOrder: number;
  choices: QuizChoice[];
}

export interface QuizChoice {
  id: string;
  questionId: string;
  choiceText: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface QuizAttempt {
  id: string;
  moduleId: string;
  questionsTotal: number;
  questionsCorrect: number;
  scorePercent: number;
  passed: boolean;
  answers: QuizAnswer[];
  startedAt: string;
  completedAt: string | null;
  timeSpentSeconds: number | null;
  attemptNumber: number;
}

export interface QuizAnswer {
  questionId: string;
  selectedChoices: string[];
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface LearningStreak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  streakStartDate: string | null;
}

export interface DailyActivity {
  activityDate: string;
  lessonsStarted: number;
  lessonsCompleted: number;
  watchTimeSeconds: number;
  quizzesTaken: number;
  quizzesPassed: number;
  engagementScore: number;
}

export interface Achievement {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  criteria: AchievementCriteria;
  sortOrder: number;
  isSecret: boolean;
  earnedAt?: string;
}

export type AchievementCriteria =
  | { type: 'lessons_completed'; count: number }
  | { type: 'modules_completed'; count: number }
  | { type: 'streak_days'; count: number }
  | { type: 'daily_lessons'; count: number }
  | { type: 'daily_watch_hours'; hours: number }
  | { type: 'perfect_quiz'; count: number }
  | { type: 'all_quizzes_passed' }
  | { type: 'watch_time_hours'; hours: number }
  | { type: 'course_percent'; value: number };

export interface CourseProgress {
  totalLessons: number;
  completedLessons: number;
  totalModules: number;
  completedModules: number;
  totalWatchTimeSeconds: number;
  totalQuizAttempts: number;
  bestQuizScores: { moduleId: string; bestScore: number }[];
  completionPercent: number;
}

export interface ModuleProgress {
  moduleId: string;
  totalLessons: number;
  completedLessons: number;
  completionPercent: number;
  isLocked: boolean;
  unlockReason?: string;
  bestQuizScore: number | null;
  quizPassed: boolean;
}

export interface UserCourseAccess {
  id: string;
  courseId: string;
  accessType: 'full' | 'preview' | 'trial' | 'expired';
  grantedAt: string;
  expiresAt: string | null;
  enrolledAt: string;
  completionDeadline: string | null;
  complianceStatus: 'not_started' | 'in_progress' | 'completed' | 'overdue';
}

// API Response types
export interface ProgressOverviewResponse {
  courseProgress: CourseProgress;
  streak: LearningStreak;
  recentActivity: DailyActivity[];
  resumeLesson: {
    lesson: CourseLesson;
    module: CourseModule;
    progress: LessonProgress;
  } | null;
}

export interface ModuleDetailResponse {
  module: CourseModule;
  lessons: (CourseLesson & { progress?: LessonProgress })[];
  quiz: {
    questionsCount: number;
    passingScore: number;
    bestAttempt: QuizAttempt | null;
    attemptsCount: number;
  } | null;
  isLocked: boolean;
  unlockReason?: string;
}

// Compliance Report types
export interface ComplianceUserReport {
  userId: string;
  userName: string;
  courseId: string;
  courseName: string;
  totalLessons: number;
  completedLessons: number;
  completionPercent: number;
  totalWatchTimeSeconds: number;
  lessonsDetail: {
    lessonId: string;
    lessonTitle: string;
    videoDurationSeconds: number;
    totalWatchTimeSeconds: number;
    uniqueWatchTimeSeconds: number;
    watchCount: number;
    completed: boolean;
    completedAt: string | null;
  }[];
  quizAttempts: {
    moduleId: string;
    moduleName: string;
    attemptNumber: number;
    scorePercent: number;
    passed: boolean;
    completedAt: string;
  }[];
}
