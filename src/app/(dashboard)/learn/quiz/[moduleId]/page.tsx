'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
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

    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (!data) return;

    setShowExplanation(false);

    if (currentQuestionIndex < data.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setQuestionStartTime(Date.now());
    } else {
      // Submit quiz
      submitQuiz();
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

  // Render results state
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
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="max-w-2xl mx-auto">
              <CardContent className="py-8">
                {/* Score Display */}
                <div className="text-center mb-8">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    results.passed
                      ? 'bg-[var(--profit)]/10'
                      : 'bg-[var(--loss)]/10'
                  }`}>
                    {results.passed ? (
                      <Trophy className="w-12 h-12 text-[var(--profit)]" />
                    ) : (
                      <XCircle className="w-12 h-12 text-[var(--loss)]" />
                    )}
                  </div>
                  <h2 className={`text-4xl font-bold mb-2 ${
                    results.passed ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
                  }`}>
                    {Math.round(results.score)}%
                  </h2>
                  <p className="text-lg text-[var(--text-secondary)]">
                    {results.passed ? 'Congratulations! You passed!' : 'Keep studying and try again!'}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 rounded-lg bg-[var(--bg-secondary)] text-center">
                    <p className="text-2xl font-bold text-[var(--profit)]">
                      {results.correctCount}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">Correct</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--bg-secondary)] text-center">
                    <p className="text-2xl font-bold text-[var(--loss)]">
                      {results.totalQuestions - results.correctCount}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">Incorrect</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-[var(--text-secondary)]">Score</span>
                    <span className="text-[var(--text-tertiary)]">
                      Pass: {data.passingScore}%
                    </span>
                  </div>
                  <ProgressBar
                    value={results.score}
                    variant={results.passed ? 'success' : 'error'}
                    size="lg"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={startQuiz}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retake Quiz
                  </Button>
                  <Link href={`/learn/${data.courseSlug}/${data.module.slug}`} className="flex-1">
                    <Button variant="primary" className="w-full">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Back to Module
                    </Button>
                  </Link>
                </div>
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

          {/* Question Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl leading-relaxed">
                    {currentQuestion.questionText}
                  </CardTitle>
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
                      <button
                        key={choice.id}
                        onClick={() => selectChoice(choice.id)}
                        disabled={showExplanation}
                        className={`
                          w-full p-4 rounded-lg border-2 text-left transition-all
                          ${bgColor} ${borderColor}
                          ${!showExplanation ? 'hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]' : ''}
                          ${showExplanation ? 'cursor-default' : 'cursor-pointer'}
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`
                            w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                            ${isSelected ? borderColor : 'border-[var(--border-secondary)]'}
                          `}>
                            {showResult ? (
                              isCorrect ? (
                                <CheckCircle2 className="w-4 h-4 text-[var(--profit)]" />
                              ) : isSelected ? (
                                <XCircle className="w-4 h-4 text-[var(--loss)]" />
                              ) : null
                            ) : (
                              isSelected && (
                                <div className="w-3 h-3 rounded-full bg-[var(--accent-primary)]" />
                              )
                            )}
                          </div>
                          <span className={`flex-1 ${textColor}`}>
                            {choice.choiceText}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Explanation */}
                  {showExplanation && currentQuestion.explanation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                    >
                      <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                        Explanation:
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {currentQuestion.explanation}
                      </p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                if (currentQuestionIndex > 0) {
                  setShowExplanation(false);
                  setCurrentQuestionIndex(prev => prev - 1);
                }
              }}
              disabled={currentQuestionIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>

            {showExplanation ? (
              <Button onClick={nextQuestion}>
                {currentQuestionIndex === data.questions.length - 1 ? (
                  <>
                    See Results
                    <Trophy className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next Question
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={submitCurrentAnswer}
                disabled={!hasAnswered}
              >
                Submit Answer
              </Button>
            )}
          </div>
        </div>
      </PageShell>
    </>
  );
}
