'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import confetti from 'canvas-confetti';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Trophy,
  RotateCcw,
  BookOpen,
  Clock,
  Target,
  Sparkles,
  Lightbulb,
  ArrowRight,
  Award,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import type { QuizQuestion, QuizChoice, CourseModule } from '@/types/learning';

interface QuizPageData {
  module: CourseModule;
  questions: QuizQuestion[];
  passingScore: number;
  previousBestScore: number | null;
  attemptsCount: number;
  courseSlug: string;
}

interface QuizAnswer {
  questionId: string;
  selectedChoiceIds: string[];
  isCorrect?: boolean;
  timeSpentSeconds: number;
}

type QuizState = 'loading' | 'ready' | 'in_progress' | 'submitting' | 'results';

// Animation variants for question card
const questionCardVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
};

// Shake animation for wrong answers
const shakeAnimation = {
  x: [0, -15, 15, -10, 10, -5, 5, 0],
  transition: { duration: 0.5 },
};

// Button press animation
const buttonPressVariants = {
  tap: { scale: 0.97 },
  hover: { scale: 1.02 },
};

// Pop animation for correct answers
const popAnimation = {
  scale: [1, 1.2, 1],
  transition: { duration: 0.3 },
};

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.moduleId as string;

  const [data, setData] = useState<QuizPageData | null>(null);
  const [quizState, setQuizState] = useState<QuizState>('loading');
  const [error, setError] = useState<string | null>(null);

  // Quiz progress state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, QuizAnswer>>(new Map());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [showExplanation, setShowExplanation] = useState(false);
  const [slideDirection, setSlideDirection] = useState(1);
  const [isShaking, setIsShaking] = useState(false);
  const [showCorrectPop, setShowCorrectPop] = useState(false);

  // Animation and sound hooks
  const cardControls = useAnimation();
  const { play: playSound } = useSoundEffects({ enabled: true });
  const confettiTriggeredRef = useRef(false);

  // Results state
  const [results, setResults] = useState<{
    score: number;
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
    answersWithResults: QuizAnswer[];
  } | null>(null);

  useEffect(() => {
    if (moduleId) {
      fetchQuizData();
    }
  }, [moduleId]);

  const fetchQuizData = async () => {
    try {
      setQuizState('loading');
      const response = await fetch(`/api/learn/quiz/${moduleId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Quiz not found');
        }
        if (response.status === 403) {
          throw new Error('Complete all lessons to unlock this quiz');
        }
        throw new Error('Failed to fetch quiz');
      }

      const quizData = await response.json();
      setData(quizData);
      setQuizState('ready');
    } catch (err) {
      console.error('Error fetching quiz:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quiz');
      setQuizState('loading');
    }
  };

  const startQuiz = () => {
    setAnswers(new Map());
    setCurrentQuestionIndex(0);
    setQuestionStartTime(Date.now());
    setShowExplanation(false);
    setResults(null);
    setQuizState('in_progress');
  };

  const selectChoice = (choiceId: string) => {
    if (!data || showExplanation) return;

    // Play selection sound
    playSound('select');

    const question = data.questions[currentQuestionIndex];
    const currentAnswer = answers.get(question.id);
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);

    let selectedChoiceIds: string[];

    if (question.questionType === 'single' || question.questionType === 'true_false') {
      selectedChoiceIds = [choiceId];
    } else {
      // Multiple choice - toggle selection
      const current = currentAnswer?.selectedChoiceIds || [];
      if (current.includes(choiceId)) {
        selectedChoiceIds = current.filter(id => id !== choiceId);
      } else {
        selectedChoiceIds = [...current, choiceId];
      }
    }

    setAnswers(prev => {
      const newAnswers = new Map(prev);
      newAnswers.set(question.id, {
        questionId: question.id,
        selectedChoiceIds,
        timeSpentSeconds: timeSpent,
      });
      return newAnswers;
    });
  };

  const submitCurrentAnswer = async () => {
    if (!data) return;

    const question = data.questions[currentQuestionIndex];
    const answer = answers.get(question.id);

    if (!answer || answer.selectedChoiceIds.length === 0) return;

    // Check if answer is correct
    const correctChoiceIds = question.choices
      .filter(c => c.isCorrect)
      .map(c => c.id);

    const isCorrect =
      answer.selectedChoiceIds.length === correctChoiceIds.length &&
      answer.selectedChoiceIds.every(id => correctChoiceIds.includes(id));

    setAnswers(prev => {
      const newAnswers = new Map(prev);
      newAnswers.set(question.id, { ...answer, isCorrect });
      return newAnswers;
    });

    // Trigger animations based on correctness
    if (isCorrect) {
      playSound('correct');
      setShowCorrectPop(true);
      setTimeout(() => setShowCorrectPop(false), 500);
    } else {
      playSound('incorrect');
      setIsShaking(true);
      await cardControls.start(shakeAnimation);
      setIsShaking(false);
    }

    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (!data) return;

    setShowExplanation(false);
    setSlideDirection(1); // Slide left to right

    if (currentQuestionIndex < data.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setQuestionStartTime(Date.now());
    } else {
      // Submit quiz
      submitQuiz();
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setShowExplanation(false);
      setSlideDirection(-1); // Slide right to left
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const submitQuiz = async () => {
    if (!data) return;

    setQuizState('submitting');

    try {
      const answersArray = Array.from(answers.values());
      const correctCount = answersArray.filter(a => a.isCorrect).length;
      const score = (correctCount / data.questions.length) * 100;
      const passed = score >= data.passingScore;

      // Submit to API
      const response = await fetch(`/api/learn/quiz/${moduleId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersArray.map(a => ({
            questionId: a.questionId,
            selectedChoiceIds: a.selectedChoiceIds,
            isCorrect: a.isCorrect,
            timeSpentSeconds: a.timeSpentSeconds,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit quiz');
      }

      // Trigger celebration if passed
      if (passed && !confettiTriggeredRef.current) {
        confettiTriggeredRef.current = true;
        playSound('celebration');

        // Massive confetti burst
        const duration = 4 * 1000;
        const animationEnd = Date.now() + duration;
        const colors = ['#d4af37', '#f5d742', '#10b981', '#3b82f6', '#ec4899'];

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) return clearInterval(interval);

          const particleCount = 60 * (timeLeft / duration);

          // Center burst
          confetti({
            particleCount: Math.floor(particleCount),
            startVelocity: 35,
            spread: 360,
            origin: { x: 0.5, y: 0.4 },
            colors,
            disableForReducedMotion: true,
          });
        }, 250);
      } else if (!passed) {
        playSound('incorrect');
      }

      setResults({
        score,
        passed,
        correctCount,
        totalQuestions: data.questions.length,
        answersWithResults: answersArray,
      });
      setQuizState('results');
    } catch (err) {
      console.error('Error submitting quiz:', err);
      setError('Failed to submit quiz');
    }
  };

  // Render loading state
  if (quizState === 'loading') {
    return (
      <>
        <Header
          title="Loading Quiz..."
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn', href: '/learn' },
            { label: 'Quiz' },
          ]}
        />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">
              Loading quiz...
            </span>
          </div>
        </PageShell>
      </>
    );
  }

  // Render error state
  if (error || !data) {
    return (
      <>
        <Header
          title="Error"
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn', href: '/learn' },
            { label: 'Quiz' },
          ]}
        />
        <PageShell>
          <Card className="border-[var(--error)] bg-[var(--error)]/10">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{error}</p>
                  <div className="flex gap-2 mt-4">
                    <Button variant="secondary" onClick={fetchQuizData}>
                      Try Again
                    </Button>
                    <Link href="/learn">
                      <Button variant="ghost">Back to Courses</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  // Render ready state (quiz intro)
  if (quizState === 'ready') {
    return (
      <>
        <Header
          title={`Module ${data.module.moduleNumber} Quiz`}
          subtitle={data.module.title}
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn', href: '/learn' },
            { label: data.module.title, href: `/learn/${data.courseSlug}/${data.module.slug}` },
            { label: 'Quiz' },
          ]}
        />
        <PageShell>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="max-w-2xl mx-auto">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-[var(--accent-primary)]" />
                </div>
                <CardTitle className="text-2xl">Ready to Test Your Knowledge?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Quiz Info */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {data.questions.length}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">Questions</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {data.passingScore}%
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">To Pass</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {data.previousBestScore !== null ? `${Math.round(data.previousBestScore)}%` : '--'}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">Best Score</p>
                  </div>
                </div>

                {/* Instructions */}
                <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]">
                  <p className="mb-2">Instructions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Read each question carefully before answering</li>
                    <li>Select your answer and click "Submit Answer"</li>
                    <li>Explanations will be shown after each answer</li>
                    <li>Your progress is saved automatically</li>
                  </ul>
                </div>

                {/* Previous Attempts */}
                {data.attemptsCount > 0 && (
                  <p className="text-sm text-[var(--text-tertiary)] text-center">
                    You&apos;ve attempted this quiz {data.attemptsCount} time{data.attemptsCount > 1 ? 's' : ''}
                  </p>
                )}

                {/* Start Button */}
                <div className="flex justify-center">
                  <Button size="lg" onClick={startQuiz}>
                    Start Quiz
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </PageShell>
      </>
    );
  }

  // Render results state with enhanced animations
  if (quizState === 'results' && results) {
    return (
      <>
        <Header
          title="Quiz Results"
          subtitle={`Module ${data.module.moduleNumber}: ${data.module.title}`}
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn', href: '/learn' },
            { label: data.module.title, href: `/learn/${data.courseSlug}/${data.module.slug}` },
            { label: 'Quiz Results' },
          ]}
        />
        <PageShell>
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Main Results Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <Card className={`overflow-hidden ${results.passed ? 'border-[var(--profit)]' : 'border-[var(--loss)]'}`}>
                <CardContent className="py-10 px-8">
                  {/* Animated Score Display */}
                  <div className="text-center mb-10">
                    <motion.div
                      className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 ${
                        results.passed
                          ? 'bg-gradient-to-br from-[var(--profit)]/20 to-[var(--profit)]/5'
                          : 'bg-gradient-to-br from-[var(--loss)]/20 to-[var(--loss)]/5'
                      }`}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                    >
                      {results.passed ? (
                        <motion.div
                          animate={{
                            scale: [1, 1.1, 1],
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Trophy className="w-16 h-16 text-[var(--profit)]" />
                        </motion.div>
                      ) : (
                        <XCircle className="w-16 h-16 text-[var(--loss)]" />
                      )}
                    </motion.div>

                    {/* Animated Count-Up Score */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <AnimatedScore
                        score={results.score}
                        passed={results.passed}
                        duration={1.5}
                      />
                    </motion.div>

                    <motion.p
                      className="text-xl text-[var(--text-secondary)] mt-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 }}
                    >
                      {results.passed ? 'Outstanding work!' : 'Keep studying and try again!'}
                    </motion.p>
                  </div>

                  {/* Animated Stats */}
                  <motion.div
                    className="grid grid-cols-3 gap-4 mb-10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                  >
                    <div className="p-5 rounded-xl bg-[var(--profit)]/10 text-center">
                      <motion.p
                        className="text-3xl font-bold text-[var(--profit)]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.2 }}
                      >
                        {results.correctCount}
                      </motion.p>
                      <p className="text-sm text-[var(--text-tertiary)]">Correct</p>
                    </div>
                    <div className="p-5 rounded-xl bg-[var(--loss)]/10 text-center">
                      <motion.p
                        className="text-3xl font-bold text-[var(--loss)]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.3 }}
                      >
                        {results.totalQuestions - results.correctCount}
                      </motion.p>
                      <p className="text-sm text-[var(--text-tertiary)]">Incorrect</p>
                    </div>
                    <div className="p-5 rounded-xl bg-[var(--bg-secondary)] text-center">
                      <motion.p
                        className="text-3xl font-bold text-[var(--text-primary)]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.4 }}
                      >
                        {results.totalQuestions}
                      </motion.p>
                      <p className="text-sm text-[var(--text-tertiary)]">Total</p>
                    </div>
                  </motion.div>

                  {/* Animated Progress Bar */}
                  <motion.div
                    className="mb-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                  >
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-[var(--text-secondary)]">Your Score</span>
                      <span className="text-[var(--text-tertiary)]">
                        Passing: {data.passingScore}%
                      </span>
                    </div>
                    <div className="h-4 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${results.passed ? 'bg-[var(--profit)]' : 'bg-[var(--loss)]'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${results.score}%` }}
                        transition={{ delay: 1.6, duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    {/* Passing threshold marker */}
                    <div className="relative h-0">
                      <div
                        className="absolute -top-5 w-0.5 h-6 bg-[var(--text-muted)]"
                        style={{ left: `${data.passingScore}%` }}
                      />
                    </div>
                  </motion.div>

                  {/* Actions */}
                  <motion.div
                    className="flex flex-col sm:flex-row gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.8 }}
                  >
                    <motion.div
                      className="flex-1"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        variant="secondary"
                        size="lg"
                        className="w-full"
                        onClick={startQuiz}
                      >
                        <RotateCcw className="w-5 h-5 mr-2" />
                        Retake Quiz
                      </Button>
                    </motion.div>
                    <Link href={`/learn/${data.courseSlug}/${data.module.slug}`} className="flex-1">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button variant="primary" size="lg" className="w-full">
                          <BookOpen className="w-5 h-5 mr-2" />
                          Back to Module
                        </Button>
                      </motion.div>
                    </Link>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Achievement Card (Passed) */}
            {results.passed && (
              <motion.div
                initial={{ opacity: 0, rotateY: 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                transition={{ delay: 2, duration: 0.6, type: 'spring' }}
              >
                <Card className="border-[var(--accent-primary)] bg-gradient-to-br from-[var(--accent-primary)]/10 via-transparent to-transparent overflow-hidden">
                  <CardContent className="py-6 px-8">
                    <div className="flex items-center gap-6">
                      <motion.div
                        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-primary-hover)] flex items-center justify-center flex-shrink-0"
                        animate={{
                          boxShadow: [
                            '0 0 20px rgba(212,175,55,0.3)',
                            '0 0 40px rgba(212,175,55,0.5)',
                            '0 0 20px rgba(212,175,55,0.3)',
                          ],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Award className="w-10 h-10 text-black" />
                      </motion.div>
                      <div>
                        <p className="text-sm text-[var(--accent-primary)] uppercase tracking-wider font-medium mb-1">
                          Module Mastery Unlocked
                        </p>
                        <h3 className="text-xl font-bold text-[var(--text-primary)]">
                          {data.module.title}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                          You&apos;ve demonstrated mastery of this module!
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Study Plan Card (Failed) */}
            {!results.passed && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2 }}
              >
                <Card className="border-[var(--warning)] bg-gradient-to-br from-[var(--warning)]/10 via-transparent to-transparent">
                  <CardContent className="py-6 px-8">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[var(--warning)]/20 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-6 h-6 text-[var(--warning)]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">
                          Study Plan
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                          Review these areas before your next attempt
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 pl-16">
                      {results.answersWithResults
                        .filter(a => !a.isCorrect)
                        .slice(0, 3)
                        .map((answer, idx) => {
                          const question = data.questions.find(q => q.id === answer.questionId);
                          return question ? (
                            <motion.div
                              key={answer.questionId}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 2.2 + idx * 0.1 }}
                              className="flex items-center gap-2 text-sm text-[var(--text-secondary)] p-2 rounded-lg bg-[var(--bg-secondary)]"
                            >
                              <XCircle className="w-4 h-4 text-[var(--loss)] flex-shrink-0" />
                              <span className="line-clamp-1">{question.questionText}</span>
                            </motion.div>
                          ) : null;
                        })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </PageShell>
      </>
    );
  }

  // Animated Score Component
  function AnimatedScore({ score, passed, duration }: { score: number; passed: boolean; duration: number }) {
    const [displayScore, setDisplayScore] = useState(0);

    useEffect(() => {
      const startTime = Date.now();
      const endTime = startTime + duration * 1000;

      const animate = () => {
        const now = Date.now();
        if (now >= endTime) {
          setDisplayScore(Math.round(score));
          return;
        }

        const progress = (now - startTime) / (duration * 1000);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        setDisplayScore(Math.round(score * eased));
        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }, [score, duration]);

    return (
      <span className={`text-6xl font-bold ${passed ? 'text-[var(--profit)]' : 'text-[var(--loss)]'}`}>
        {displayScore}%
      </span>
    );
  }

  // Render in_progress state (quiz questions)
  const currentQuestion = data.questions[currentQuestionIndex];
  const currentAnswer = answers.get(currentQuestion.id);
  const hasAnswered = currentAnswer && currentAnswer.selectedChoiceIds.length > 0;
  const progress = ((currentQuestionIndex + 1) / data.questions.length) * 100;

  return (
    <>
      <Header
        title={`Question ${currentQuestionIndex + 1} of ${data.questions.length}`}
        subtitle={`Module ${data.module.moduleNumber}: ${data.module.title}`}
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learn', href: '/learn' },
          { label: data.module.title },
          { label: 'Quiz' },
        ]}
      />
      <PageShell>
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ProgressBar value={progress} variant="gold" size="sm" />
          </motion.div>

          {/* Question Card with Enhanced Animations */}
          <AnimatePresence mode="wait" custom={slideDirection}>
            <motion.div
              key={currentQuestionIndex}
              custom={slideDirection}
              variants={questionCardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <motion.div animate={cardControls}>
                <Card className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="gold" size="sm">
                        <Target className="w-3 h-3 mr-1" />
                        Question {currentQuestionIndex + 1}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl leading-relaxed">
                      {currentQuestion.questionText}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {currentQuestion.choices.map((choice, index) => {
                      const isSelected = currentAnswer?.selectedChoiceIds.includes(choice.id);
                      const showResult = showExplanation;
                      const isCorrect = choice.isCorrect;
                      const isWrongSelected = isSelected && !isCorrect && showResult;
                      const isCorrectShown = isCorrect && showResult;

                      return (
                        <motion.button
                          key={choice.id}
                          onClick={() => selectChoice(choice.id)}
                          disabled={showExplanation}
                          variants={buttonPressVariants}
                          whileHover={!showExplanation ? 'hover' : undefined}
                          whileTap={!showExplanation ? 'tap' : undefined}
                          animate={isCorrectShown && showCorrectPop ? popAnimation : undefined}
                          className={`
                            w-full p-4 rounded-xl border-2 text-left transition-all
                            ${isCorrectShown
                              ? 'bg-[var(--profit)]/10 border-[var(--profit)]'
                              : isWrongSelected
                              ? 'bg-[var(--loss)]/10 border-[var(--loss)]'
                              : isSelected
                              ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]'
                              : 'bg-[var(--bg-secondary)] border-[var(--border-primary)]'
                            }
                            ${!showExplanation ? 'hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] hover:shadow-md' : ''}
                            ${showExplanation ? 'cursor-default' : 'cursor-pointer'}
                          `}
                        >
                          <div className="flex items-center gap-4">
                            {/* Choice Indicator */}
                            <div className={`
                              w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                              ${isCorrectShown
                                ? 'border-[var(--profit)] bg-[var(--profit)]'
                                : isWrongSelected
                                ? 'border-[var(--loss)] bg-[var(--loss)]'
                                : isSelected
                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                                : 'border-[var(--border-secondary)]'
                              }
                            `}>
                              {showResult ? (
                                isCorrectShown ? (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 500 }}
                                  >
                                    <CheckCircle2 className="w-5 h-5 text-white" />
                                  </motion.div>
                                ) : isWrongSelected ? (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 500 }}
                                  >
                                    <XCircle className="w-5 h-5 text-white" />
                                  </motion.div>
                                ) : (
                                  <span className="text-sm font-medium text-[var(--text-tertiary)]">
                                    {String.fromCharCode(65 + index)}
                                  </span>
                                )
                              ) : isSelected ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-3 h-3 rounded-full bg-white"
                                />
                              ) : (
                                <span className="text-sm font-medium text-[var(--text-tertiary)]">
                                  {String.fromCharCode(65 + index)}
                                </span>
                              )}
                            </div>

                            {/* Choice Text */}
                            <span className={`flex-1 font-medium ${
                              isCorrectShown
                                ? 'text-[var(--profit)]'
                                : isWrongSelected
                                ? 'text-[var(--loss)]'
                                : 'text-[var(--text-primary)]'
                            }`}>
                              {choice.choiceText}
                            </span>

                            {/* Result Icon */}
                            {isCorrectShown && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 }}
                              >
                                <Sparkles className="w-5 h-5 text-[var(--profit)]" />
                              </motion.div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}

                    {/* Knowledge Gap Card for Incorrect Answers */}
                    <AnimatePresence>
                      {showExplanation && currentAnswer && !currentAnswer.isCorrect && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, y: -20 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          className="mt-4"
                        >
                          <Card className="border-[var(--warning)] bg-gradient-to-r from-[var(--warning)]/5 to-transparent">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--warning)]/20 flex items-center justify-center flex-shrink-0">
                                  <Lightbulb className="w-5 h-5 text-[var(--warning)]" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-[var(--text-primary)] mb-1">
                                    Knowledge Gap Identified
                                  </p>
                                  {currentQuestion.explanation && (
                                    <p className="text-sm text-[var(--text-secondary)] mb-3">
                                      {currentQuestion.explanation}
                                    </p>
                                  )}
                                  {currentQuestion.videoTimestamp && (
                                    <Link
                                      href={`/learn/${data.courseSlug}/${data.module.slug}?t=${currentQuestion.videoTimestamp}`}
                                      className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                                    >
                                      <BookOpen className="w-4 h-4" />
                                      Review this topic in the video
                                      <ArrowRight className="w-3 h-3" />
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Success Explanation Card */}
                    <AnimatePresence>
                      {showExplanation && currentAnswer?.isCorrect && currentQuestion.explanation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, y: -20 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          className="mt-4"
                        >
                          <Card className="border-[var(--profit)] bg-gradient-to-r from-[var(--profit)]/5 to-transparent">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--profit)]/20 flex items-center justify-center flex-shrink-0">
                                  <Zap className="w-5 h-5 text-[var(--profit)]" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-[var(--profit)] mb-1">
                                    Correct!
                                  </p>
                                  <p className="text-sm text-[var(--text-secondary)]">
                                    {currentQuestion.explanation}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Actions */}
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button
              variant="ghost"
              onClick={prevQuestion}
              disabled={currentQuestionIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>

            {showExplanation ? (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Button onClick={nextQuestion} size="lg">
                  {currentQuestionIndex === data.questions.length - 1 ? (
                    <>
                      See Results
                      <Trophy className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Next Question
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={submitCurrentAnswer}
                  disabled={!hasAnswered}
                  size="lg"
                >
                  Submit Answer
                </Button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </PageShell>
    </>
  );
}
