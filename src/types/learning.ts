// Learning System Types with Compliance Support

// ============================================
// RESOURCE TYPES (NEW)
// ============================================

export type ResourceType = 'pdf' | 'link' | 'image' | 'download';

export interface Resource {
  type: ResourceType;
  title: string;
  url: string;
  description?: string;
  /** File size in bytes (for downloads) */
  size?: number;
  /** MIME type for proper handling */
  mimeType?: string;
}

// ============================================
// VIDEO STATUS
// ============================================

export type VideoStatus = 'pending' | 'processing' | 'ready' | 'error';

// ============================================
// COURSE STRUCTURE
// ============================================

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
  videoStatus: VideoStatus;
  videoPlaybackHls: string | null;
  videoPlaybackDash: string | null;
  videoThumbnailAnimated: string | null;
  thumbnailUrl: string | null;
  transcriptUrl: string | null;
  transcriptText: string | null;
  resources: Resource[];
  requireSignedUrls: boolean;
  sortOrder: number;
  isPreview: boolean;
  isPublished: boolean;
  isRequired: boolean;
  minWatchPercent: number;
  allowSkip: boolean;
  createdAt: string;
  // Computed fields
  chapters?: LessonChapter[];
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

// ============================================
// LESSON CHAPTERS (Timeline Markers)
// ============================================

export interface LessonChapter {
  id: string;
  lessonId: string;
  title: string;
  timestampSeconds: number;
  description: string | null;
  conceptTag: string | null;
  sortOrder: number;
  createdAt: string;
}

// ============================================
// LEARNING PATHS
// ============================================

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'all';

export interface PathModule {
  moduleId: string;
  order: number;
  isOptional: boolean;
}

export interface LearningPath {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  skillLevel: SkillLevel;
  estimatedHours: number | null;
  pathModules: PathModule[];
  sortOrder: number;
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed
  modules?: CourseModule[];
}

export interface UserLearningPath {
  id: string;
  userId: string;
  pathId: string;
  startedAt: string;
  completedAt: string | null;
  currentModuleId: string | null;
  modulesCompleted: number;
  totalModules: number;
  progressPercent: number;
  createdAt: string;
  // Computed
  path?: LearningPath;
}

// ============================================
// BOOKMARKS & NOTES
// ============================================

export interface LessonBookmark {
  id: string;
  userId: string;
  lessonId: string;
  timestampSeconds: number;
  title: string | null;
  note: string | null;
  color: string;
  createdAt: string;
  // Computed
  lesson?: CourseLesson;
}

// ============================================
// CLOUDFLARE STREAM TYPES
// ============================================

export interface CloudflareStreamVideo {
  uid: string;
  thumbnail: string;
  thumbnailTimestampPct: number;
  readyToStream: boolean;
  status: {
    state: 'pendingupload' | 'downloading' | 'queued' | 'inprogress' | 'ready' | 'error';
    pctComplete?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  meta: {
    name: string;
  };
  created: string;
  modified: string;
  duration: number;
  input: {
    width: number;
    height: number;
  };
  playback: {
    hls: string;
    dash: string;
  };
  preview: string;
  allowedOrigins?: string[];
  requireSignedURLs: boolean;
  uploaded?: string;
  size?: number;
}

export interface CloudflareUploadResponse {
  result: CloudflareStreamVideo;
  success: boolean;
  errors: unknown[];
  messages: unknown[];
}

export interface CloudflareSignedUrlResponse {
  result: {
    token: string;
  };
  success: boolean;
  errors: unknown[];
  messages: unknown[];
}

// ============================================
// HELPER TYPES
// ============================================

/** Lesson with all related data */
export interface LessonWithDetails extends CourseLesson {
  chapters: LessonChapter[];
  module: CourseModule;
  course: Course;
  nextLesson?: {
    id: string;
    title: string;
    slug: string;
  };
  prevLesson?: {
    id: string;
    title: string;
    slug: string;
  };
}

/** Module with completion stats */
export interface ModuleWithProgress extends CourseModule {
  lessonsCompleted: number;
  totalLessons: number;
  quizBestScore: number | null;
  quizPassed: boolean;
  isLocked: boolean;
  unlockReason?: string;
}

/** Course with user's access and progress */
export interface CourseWithAccess extends Course {
  access: UserCourseAccess | null;
  progress: CourseProgress | null;
  modulesWithProgress?: ModuleWithProgress[];
}
