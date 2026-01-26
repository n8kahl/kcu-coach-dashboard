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
import { useConfetti } from '@/hooks/useConfetti';
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
  Award,
  Lightbulb,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import type { QuizQuestion, QuizChoice, CourseModule } from '@/types/learning';

// Sound effects hook stub
function useSoundEffects() {
  const playSelect = useCallback(() => {
    // Stub: Would play selection sound
    // console.log('[Sound] Select');
  }, []);

  const playCorrect = useCallback(() => {
    // Stub: Would play correct answer sound
    // console.log('[Sound] Correct');
  }, []);

  const playIncorrect = useCallback(() => {
    // Stub: Would play incorrect answer sound
    // console.log('[Sound] Incorrect');
  }, []);

  const playSuccess = useCallback(() => {
    // Stub: Would play success/win sound
    // console.log('[Sound] Success');
  }, []);

  const playFailure = useCallback(() => {
    // Stub: Would play failure sound
    // console.log('[Sound] Failure');
  }, []);

  return {
    playSelect,
    playCorrect,
    playIncorrect,
    playSuccess,
    playFailure,
  };
}

// Animated count-up hook
function useCountUp(end: number, duration: number = 1500, enabled: boolean = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [end, duration, enabled]);

  return count;
}

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

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.moduleId as string;
  const confetti = useConfetti();
  const sound = useSoundEffects();

  const [data, setData] = useState<QuizPageData | null>(null);
  const [quizState, setQuizState] = useState<QuizState>('loading');
  const [error, setError] = useState<string | null>(null);

  // Quiz progress state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, QuizAnswer>>(new Map());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [showExplanation, setShowExplanation] = useState(false);
  const [shakeCard, setShakeCard] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  // Results state
  const [results, setResults] = useState<{
    score: number;
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
    answersWithResults: QuizAnswer[];
  } | null>(null);
  const [showResults, setShowResults] = useState(false);

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
    sound.playSelect();

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

  const submitCurrentAnswer = () => {
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

    // Trigger animations and sounds based on answer
    if (isCorrect) {
      sound.playCorrect();
      confetti.quickPop({ x: 0.5, y: 0.4 });
    } else {
      sound.playIncorrect();
      // Trigger shake animation
      setShakeCard(true);
      setTimeout(() => setShakeCard(false), 500);
    }

    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (!data) return;

    setShowExplanation(false);
    setSlideDirection('right');

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
      setSlideDirection('left');
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

      setResults({
        score,
        passed,
        correctCount,
        totalQuestions: data.questions.length,
        answersWithResults: answersArray,
      });

      // Trigger celebration or consolation
      if (passed) {
        sound.playSuccess();
        // Delay confetti slightly for dramatic effect
        setTimeout(() => {
          confetti.massiveCelebration();
        }, 500);
      } else {
        sound.playFailure();
      }

      setQuizState('results');
      // Enable count-up animation
      setTimeout(() => setShowResults(true), 300);
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

  // Animated score count-up
  const animatedScore = useCountUp(
    results?.score || 0,
    1500,
    showResults && quizState === 'results'
  );

  // Render results state
  if (quizState === 'results' && results) {
    // Find incorrect questions for study plan
    const incorrectQuestions = results.answersWithResults
      .filter(a => !a.isCorrect)
      .map(a => data.questions.find(q => q.id === a.questionId))
      .filter(Boolean);

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
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <Card className="max-w-2xl mx-auto overflow-hidden">
              {/* Celebration Header */}
              {results.passed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative bg-gradient-to-r from-[var(--accent-primary)] via-[var(--profit)] to-[var(--accent-primary)] p-6 text-center"
                  style={{
                    backgroundSize: '200% 100%',
                    animation: 'gradient-shift 3s ease infinite',
                  }}
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                    className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center shadow-xl mb-4"
                  >
                    <Award className="w-10 h-10 text-[var(--accent-primary)]" />
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-2xl font-bold text-black"
                  >
                    Quiz Passed!
                  </motion.h2>
                </motion.div>
              )}

              <CardContent className="py-8">
                {/* Score Display */}
                <div className="text-center mb-8">
                  {!results.passed && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                      className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 bg-[var(--loss)]/10"
                    >
                      <XCircle className="w-12 h-12 text-[var(--loss)]" />
                    </motion.div>
                  )}

                  {/* Animated Score */}
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4, type: 'spring' }}
                  >
                    <span className={`text-6xl font-bold ${
                      results.passed
                        ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--profit)] bg-clip-text text-transparent'
                        : 'text-[var(--loss)]'
                    }`}>
                      {animatedScore}%
                    </span>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-lg text-[var(--text-secondary)] mt-4"
                  >
                    {results.passed
                      ? 'Outstanding work! You\'ve mastered this module.'
                      : 'Keep studying and try again!'}
                  </motion.p>
                </div>

                {/* Stats with Animation */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="grid grid-cols-3 gap-4 mb-8"
                >
                  <div className="p-4 rounded-xl bg-[var(--profit)]/10 text-center border border-[var(--profit)]/20">
                    <motion.p
                      className="text-3xl font-bold text-[var(--profit)]"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.8, type: 'spring' }}
                    >
                      {results.correctCount}
                    </motion.p>
                    <p className="text-xs text-[var(--text-tertiary)]">Correct</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--loss)]/10 text-center border border-[var(--loss)]/20">
                    <motion.p
                      className="text-3xl font-bold text-[var(--loss)]"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.9, type: 'spring' }}
                    >
                      {results.totalQuestions - results.correctCount}
                    </motion.p>
                    <p className="text-xs text-[var(--text-tertiary)]">Incorrect</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] text-center border border-[var(--border-primary)]">
                    <motion.p
                      className="text-3xl font-bold text-[var(--text-primary)]"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1, type: 'spring' }}
                    >
                      {results.totalQuestions}
                    </motion.p>
                    <p className="text-xs text-[var(--text-tertiary)]">Total</p>
                  </div>
                </motion.div>

                {/* Progress Bar with passing threshold */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  className="mb-8 relative"
                >
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-[var(--text-secondary)]">Your Score</span>
                    <span className="text-[var(--text-tertiary)]">
                      Pass: {data.passingScore}%
                    </span>
                  </div>
                  <div className="relative">
                    <ProgressBar
                      value={results.score}
                      variant={results.passed ? 'success' : 'error'}
                      size="lg"
                    />
                    {/* Passing threshold marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white/50"
                      style={{ left: `${data.passingScore}%` }}
                    />
                  </div>
                </motion.div>

                {/* Study Plan for Failed Quiz */}
                {!results.passed && incorrectQuestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                    className="mb-8 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)]"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-5 h-5 text-[var(--accent-primary)]" />
                      <h3 className="font-semibold text-[var(--text-primary)]">Study Plan</h3>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-3">
                      Review these topics to improve your score:
                    </p>
                    <ul className="space-y-2">
                      {incorrectQuestions.slice(0, 3).map((q, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-[var(--loss)]">•</span>
                          <span className="text-[var(--text-tertiary)]">
                            {q?.questionText.slice(0, 80)}...
                          </span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}

                {/* Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3 }}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setShowResults(false);
                      startQuiz();
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retake Quiz
                  </Button>
                  <Link href={`/learn/${data.courseSlug}/${data.module.slug}`} className="flex-1">
                    <Button variant="primary" className="w-full">
                      <BookOpen className="w-4 h-4 mr-2" />
                      {results.passed ? 'Continue Learning' : 'Review Module'}
                    </Button>
                  </Link>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </PageShell>
      </>
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

          {/* Question Card with Slide and Shake Animations */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{
                opacity: 0,
                x: slideDirection === 'right' ? 100 : -100,
              }}
              animate={{
                opacity: 1,
                x: shakeCard ? [0, -10, 10, -10, 10, -5, 5, 0] : 0,
              }}
              exit={{
                opacity: 0,
                x: slideDirection === 'right' ? -100 : 100,
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
                x: shakeCard ? { duration: 0.4, ease: 'easeInOut' } : undefined,
              }}
            >
              <Card
                className={`overflow-hidden ${
                  showExplanation && currentAnswer?.isCorrect
                    ? 'border-[var(--profit)]/50'
                    : showExplanation && !currentAnswer?.isCorrect
                    ? 'border-[var(--loss)]/50'
                    : ''
                }`}
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center text-sm font-bold text-[var(--accent-primary)]">
                      {currentQuestionIndex + 1}
                    </span>
                    <CardTitle className="text-xl leading-relaxed flex-1">
                      {currentQuestion.questionText}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentQuestion.choices.map((choice, index) => {
                    const isSelected = currentAnswer?.selectedChoiceIds.includes(choice.id);
                    const showResult = showExplanation;
                    const isCorrect = choice.isCorrect;

                    let bgColor = 'bg-[var(--bg-secondary)]';
                    let borderColor = 'border-[var(--border-primary)]';
                    let textColor = 'text-[var(--text-primary)]';

                    if (showResult) {
                      if (isCorrect) {
                        bgColor = 'bg-[var(--profit)]/10';
                        borderColor = 'border-[var(--profit)]';
                        textColor = 'text-[var(--profit)]';
                      } else if (isSelected && !isCorrect) {
                        bgColor = 'bg-[var(--loss)]/10';
                        borderColor = 'border-[var(--loss)]';
                        textColor = 'text-[var(--loss)]';
                      }
                    } else if (isSelected) {
                      bgColor = 'bg-[var(--accent-primary)]/10';
                      borderColor = 'border-[var(--accent-primary)]';
                    }

                    return (
                      <motion.button
                        key={choice.id}
                        onClick={() => selectChoice(choice.id)}
                        disabled={showExplanation}
                        whileTap={!showExplanation ? { scale: 0.98 } : undefined}
                        whileHover={!showExplanation ? { scale: 1.01 } : undefined}
                        className={`
                          w-full p-4 rounded-xl border-2 text-left transition-colors
                          ${bgColor} ${borderColor}
                          ${!showExplanation ? 'hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]' : ''}
                          ${showExplanation ? 'cursor-default' : 'cursor-pointer'}
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <motion.div
                            className={`
                              w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                              ${isSelected ? borderColor : 'border-[var(--border-secondary)]'}
                            `}
                            animate={
                              showResult && isCorrect
                                ? { scale: [1, 1.2, 1] }
                                : undefined
                            }
                            transition={{ duration: 0.3 }}
                          >
                            {showResult ? (
                              isCorrect ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 500 }}
                                >
                                  <CheckCircle2 className="w-4 h-4 text-[var(--profit)]" />
                                </motion.div>
                              ) : isSelected ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 500 }}
                                >
                                  <XCircle className="w-4 h-4 text-[var(--loss)]" />
                                </motion.div>
                              ) : null
                            ) : (
                              isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-3 h-3 rounded-full bg-[var(--accent-primary)]"
                                />
                              )
                            )}
                          </motion.div>
                          <span className={`flex-1 ${textColor}`}>
                            {choice.choiceText}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}

                  {/* Knowledge Gap Card for Wrong Answers */}
                  <AnimatePresence>
                    {showExplanation && !currentAnswer?.isCorrect && currentQuestion.explanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -20 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -20 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[var(--loss)]/5 to-[var(--bg-tertiary)] border border-[var(--loss)]/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-5 h-5 text-[var(--loss)]" />
                            <p className="text-sm font-semibold text-[var(--loss)]">
                              Knowledge Gap Identified
                            </p>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {currentQuestion.explanation}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Success Explanation */}
                  <AnimatePresence>
                    {showExplanation && currentAnswer?.isCorrect && currentQuestion.explanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -20 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -20 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[var(--profit)]/5 to-[var(--bg-tertiary)] border border-[var(--profit)]/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-5 h-5 text-[var(--profit)]" />
                            <p className="text-sm font-semibold text-[var(--profit)]">
                              Correct!
                            </p>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {currentQuestion.explanation}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
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
                      <Sparkles className="w-4 h-4 mr-2" />
                      See Results
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
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
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
