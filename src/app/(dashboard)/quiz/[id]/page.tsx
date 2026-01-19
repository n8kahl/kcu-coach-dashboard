'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressBar, CircularProgress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Trophy,
  RotateCcw,
  Home,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface QuizQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
}

interface Quiz {
  id: string;
  moduleId: string | null;
  moduleSlug: string | null;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  questions: QuizQuestion[];
  questionsCount: number;
}

interface GradedAnswer {
  questionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  isCorrect: boolean;
  explanation?: string;
}

interface QuizResult {
  attemptId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  timeTaken: number | null;
  answers: GradedAnswer[];
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id as string;

  // Quiz data state
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quiz progress state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch quiz data
  useEffect(() => {
    async function fetchQuiz() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/learning/v2/quizzes/${quizId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Quiz not found');
          } else {
            setError('Failed to load quiz');
          }
          return;
        }

        const data = await response.json();
        setQuiz(data);
        setTimeRemaining(data.timeLimit || 300);
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError('Failed to load quiz');
      } finally {
        setLoading(false);
      }
    }

    fetchQuiz();
  }, [quizId]);

  // Timer
  useEffect(() => {
    if (!quizStarted || showResults || !quiz?.timeLimit) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quizStarted, showResults, quiz?.timeLimit]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectAnswer = (optionId: string) => {
    if (showExplanation || !quiz) return;
    const currentQuestion = quiz.questions[currentQuestionIndex];
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionId,
    }));
  };

  const handleSubmitQuiz = useCallback(async () => {
    if (!quiz || submitting) return;

    setSubmitting(true);

    try {
      const answers = quiz.questions.map((q) => ({
        questionId: q.id,
        selectedOptionId: selectedAnswers[q.id] || '',
      }));

      const timeTaken = quiz.timeLimit ? quiz.timeLimit - timeRemaining : undefined;

      const response = await fetch(`/api/learning/v2/quizzes/${quizId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, timeTaken }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit quiz');
      }

      const result = await response.json();
      setQuizResult(result);
      setShowResults(true);
    } catch (err) {
      console.error('Error submitting quiz:', err);
      setError('Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [quiz, selectedAnswers, timeRemaining, quizId, submitting]);

  const handleNextQuestion = () => {
    if (!quiz) return;
    setShowExplanation(false);
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setShowExplanation(false);
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setShowResults(false);
    setQuizResult(null);
    setShowExplanation(false);
    setTimeRemaining(quiz?.timeLimit || 300);
    setQuizStarted(true);
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Header title="Loading Quiz..." breadcrumbs={[{ label: 'Dashboard' }, { label: 'Quiz' }]} />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">Loading quiz...</span>
          </div>
        </PageShell>
      </>
    );
  }

  // Error state
  if (error || !quiz) {
    return (
      <>
        <Header title="Quiz" breadcrumbs={[{ label: 'Dashboard' }, { label: 'Quiz' }]} />
        <PageShell>
          <Card className="border-[var(--error)] bg-[var(--error)]/10">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                <p className="font-medium text-[var(--text-primary)]">{error || 'Quiz not found'}</p>
                <Link href="/learning">
                  <Button variant="secondary">Back to Learning</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const selectedAnswer = selectedAnswers[currentQuestion?.id];

  // Start Screen
  if (!quizStarted) {
    return (
      <>
        <Header
          title={quiz.title}
          subtitle={quiz.moduleSlug ? `Module Quiz` : undefined}
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learning', href: '/learning' },
            ...(quiz.moduleSlug ? [{ label: 'Module', href: `/learning/${quiz.moduleSlug}` }] : []),
            { label: 'Quiz' },
          ]}
        />

        <PageShell>
          <div className="max-w-2xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card variant="glow">
                <CardContent className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center bg-[var(--accent-primary-glow)]">
                    <Trophy className="w-10 h-10 text-[var(--accent-primary)]" />
                  </div>

                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{quiz.title}</h2>
                  <p className="text-[var(--text-secondary)] mb-8">{quiz.description}</p>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {quiz.questionsCount}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">Questions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {quiz.timeLimit ? formatTime(quiz.timeLimit) : 'No Limit'}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">Time Limit</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[var(--accent-primary)]">
                        {quiz.passingScore}%
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">To Pass</p>
                    </div>
                  </div>

                  <Button variant="primary" size="lg" onClick={() => setQuizStarted(true)} className="px-12">
                    Start Quiz
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </PageShell>
      </>
    );
  }

  // Results Screen
  if (showResults && quizResult) {
    return (
      <>
        <Header
          title="Quiz Results"
          subtitle={quiz.title}
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learning', href: '/learning' },
            ...(quiz.moduleSlug ? [{ label: 'Module', href: `/learning/${quiz.moduleSlug}` }] : []),
            { label: 'Quiz Results' },
          ]}
        />

        <PageShell>
          <div className="max-w-2xl mx-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card variant="glow">
                <CardContent className="text-center py-12">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                  >
                    <CircularProgress
                      value={quizResult.percentage}
                      size={160}
                      strokeWidth={12}
                      variant={quizResult.passed ? 'success' : 'default'}
                      className="mx-auto mb-6"
                    />
                  </motion.div>

                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                    {quizResult.passed ? 'Congratulations!' : 'Keep Practicing!'}
                  </h2>
                  <p className="text-[var(--text-secondary)] mb-6">
                    You scored {quizResult.score} out of {quizResult.totalQuestions} (
                    {quizResult.percentage}%)
                  </p>

                  <Badge variant={quizResult.passed ? 'success' : 'warning'} size="lg" className="mb-8">
                    {quizResult.passed ? 'PASSED' : 'NOT PASSED'}
                  </Badge>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-[var(--bg-tertiary)]">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-[var(--profit)]" />
                        <span className="text-xl font-bold text-[var(--profit)]">{quizResult.score}</span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">Correct</p>
                    </div>
                    <div className="p-4 bg-[var(--bg-tertiary)]">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-[var(--loss)]" />
                        <span className="text-xl font-bold text-[var(--loss)]">
                          {quizResult.totalQuestions - quizResult.score}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">Incorrect</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <Button variant="secondary" icon={<RotateCcw className="w-4 h-4" />} onClick={handleRetake}>
                      Retake Quiz
                    </Button>
                    <Link href={quiz.moduleSlug ? `/learning/${quiz.moduleSlug}` : '/learning'}>
                      <Button variant="primary" icon={<Home className="w-4 h-4" />}>
                        {quiz.moduleSlug ? 'Back to Module' : 'Back to Learning'}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Question Review */}
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Review Answers</h3>
                {quizResult.answers.map((answer, index) => {
                  const question = quiz.questions.find((q) => q.id === answer.questionId);
                  if (!question) return null;

                  return (
                    <Card key={answer.questionId}>
                      <CardContent>
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-8 h-8 flex items-center justify-center flex-shrink-0',
                              answer.isCorrect
                                ? 'bg-[rgba(34,197,94,0.15)] text-[var(--profit)]'
                                : 'bg-[rgba(239,68,68,0.15)] text-[var(--loss)]'
                            )}
                          >
                            {answer.isCorrect ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <XCircle className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-[var(--text-muted)] mb-1">Question {index + 1}</p>
                            <p className="font-medium text-[var(--text-primary)] mb-2">{question.question}</p>
                            <p className="text-sm text-[var(--text-secondary)]">
                              <span className="text-[var(--profit)]">Correct: </span>
                              {question.options.find((o) => o.id === answer.correctOptionId)?.text}
                            </p>
                            {!answer.isCorrect && answer.selectedOptionId && (
                              <p className="text-sm text-[var(--text-secondary)]">
                                <span className="text-[var(--loss)]">Your answer: </span>
                                {question.options.find((o) => o.id === answer.selectedOptionId)?.text}
                              </p>
                            )}
                            {answer.explanation && (
                              <p className="text-sm text-[var(--text-muted)] mt-2 italic">{answer.explanation}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </PageShell>
      </>
    );
  }

  // Quiz Screen
  return (
    <>
      <Header
        title={`Question ${currentQuestionIndex + 1} of ${quiz.questions.length}`}
        subtitle={quiz.title}
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learning', href: '/learning' },
          ...(quiz.moduleSlug ? [{ label: 'Module', href: `/learning/${quiz.moduleSlug}` }] : []),
          { label: 'Quiz' },
        ]}
      />

      <PageShell>
        <div className="max-w-2xl mx-auto">
          {/* Timer and Progress */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock
                      className={cn(
                        'w-5 h-5',
                        timeRemaining < 60 ? 'text-[var(--loss)]' : 'text-[var(--text-secondary)]'
                      )}
                    />
                    <span
                      className={cn(
                        'font-mono text-lg font-bold',
                        timeRemaining < 60 ? 'text-[var(--loss)]' : 'text-[var(--text-primary)]'
                      )}
                    >
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">
                    {currentQuestionIndex + 1}/{quiz.questions.length}
                  </span>
                </div>
                <ProgressBar
                  value={((currentQuestionIndex + 1) / quiz.questions.length) * 100}
                  variant="gold"
                  size="sm"
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card variant="glow">
                <CardContent>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">
                    {currentQuestion.question}
                  </h2>

                  <div className="space-y-3">
                    {currentQuestion.options.map((option) => {
                      const isSelected = selectedAnswer === option.id;

                      return (
                        <motion.button
                          key={option.id}
                          onClick={() => handleSelectAnswer(option.id)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className={cn(
                            'w-full p-4 text-left transition-all duration-150',
                            'border',
                            isSelected
                              ? 'bg-[var(--accent-primary-glow)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                              : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-secondary)]'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'w-8 h-8 flex items-center justify-center text-sm font-medium',
                                isSelected
                                  ? 'bg-[var(--accent-primary)] text-black'
                                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                              )}
                            >
                              {option.id.toUpperCase()}
                            </span>
                            <span className="flex-1">{option.text}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6"
          >
            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={handlePrevQuestion}
                    disabled={currentQuestionIndex === 0}
                    icon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Previous
                  </Button>

                  <Button
                    variant="primary"
                    onClick={handleNextQuestion}
                    disabled={!selectedAnswer || submitting}
                    icon={
                      submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )
                    }
                  >
                    {currentQuestionIndex === quiz.questions.length - 1
                      ? submitting
                        ? 'Submitting...'
                        : 'Submit Quiz'
                      : 'Next Question'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </PageShell>
    </>
  );
}
