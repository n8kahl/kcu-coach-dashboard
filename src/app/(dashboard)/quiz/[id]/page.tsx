'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Mock quiz data - in real app, fetch from API
const mockQuiz = {
  id: 'quiz_ltp_framework',
  title: 'LTP Framework Quiz',
  description: 'Test your understanding of Levels, Trends, and Patience concepts.',
  moduleId: 'mod_ltp_framework',
  moduleSlug: 'ltp-framework',
  moduleName: 'LTP Framework',
  passingScore: 70,
  timeLimit: 300, // 5 minutes in seconds
  questions: [
    {
      id: 'q1',
      question: 'What does LTP stand for in the KCU trading methodology?',
      options: [
        { id: 'a', text: 'Long Term Profit' },
        { id: 'b', text: 'Levels, Trends, Patience' },
        { id: 'c', text: 'Low Trade Price' },
        { id: 'd', text: 'Limit Trading Position' },
      ],
      correctOptionId: 'b',
      explanation:
        'LTP stands for Levels, Trends, and Patience - the three key components that must align for a high-probability trade setup.',
    },
    {
      id: 'q2',
      question: 'What timeframe is recommended for drawing hourly levels?',
      options: [
        { id: 'a', text: '5-minute chart' },
        { id: 'b', text: '15-minute chart' },
        { id: 'c', text: '60-minute (1-hour) chart' },
        { id: 'd', text: 'Daily chart' },
      ],
      correctOptionId: 'c',
      explanation:
        'The 60-minute chart is the preferred timeframe for drawing hourly levels as it provides the best balance of meaningful support/resistance levels.',
    },
    {
      id: 'q3',
      question: 'What is a "patience candle" in the LTP framework?',
      options: [
        { id: 'a', text: 'A very large bullish candle' },
        { id: 'b', text: 'A small consolidation candle at a key level' },
        { id: 'c', text: 'The first candle of the day' },
        { id: 'd', text: 'A candle that closes at VWAP' },
      ],
      correctOptionId: 'b',
      explanation:
        'A patience candle is a small consolidation candle that forms at a key level, showing equilibrium between buyers and sellers before a potential breakout.',
    },
    {
      id: 'q4',
      question: 'When should you draw your hourly levels?',
      options: [
        { id: 'a', text: 'After market close' },
        { id: 'b', text: 'During market hours' },
        { id: 'c', text: 'Fresh every morning before market open' },
        { id: 'd', text: 'Once a week on Sunday' },
      ],
      correctOptionId: 'c',
      explanation:
        'You should draw fresh levels every morning before market open. Never carry over old levels - draw them new each day.',
    },
    {
      id: 'q5',
      question: 'Where should you place your stop loss when trading a patience candle breakout?',
      options: [
        { id: 'a', text: 'At the previous day low' },
        { id: 'b', text: 'On the other side of the patience candle' },
        { id: 'c', text: 'At VWAP' },
        { id: 'd', text: '2% below entry' },
      ],
      correctOptionId: 'b',
      explanation:
        'Your stop loss should be placed on the other side of the patience candle. This gives the trade room to breathe while invalidating the setup if the level fails.',
    },
  ],
};

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id as string;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(mockQuiz.timeLimit);
  const [quizStarted, setQuizStarted] = useState(false);

  const currentQuestion = mockQuiz.questions[currentQuestionIndex];
  const selectedAnswer = selectedAnswers[currentQuestion.id];
  const isCorrect = selectedAnswer === currentQuestion.correctOptionId;

  // Timer
  useEffect(() => {
    if (!quizStarted || showResults) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowResults(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quizStarted, showResults]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectAnswer = (optionId: string) => {
    if (showExplanation) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionId,
    }));
  };

  const handleCheckAnswer = () => {
    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    setShowExplanation(false);
    if (currentQuestionIndex < mockQuiz.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setShowExplanation(false);
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    mockQuiz.questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctOptionId) {
        correct++;
      }
    });
    return {
      correct,
      total: mockQuiz.questions.length,
      percentage: Math.round((correct / mockQuiz.questions.length) * 100),
    };
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setShowResults(false);
    setShowExplanation(false);
    setTimeRemaining(mockQuiz.timeLimit);
    setQuizStarted(true);
  };

  // Start Screen
  if (!quizStarted) {
    return (
      <>
        <Header
          title={mockQuiz.title}
          subtitle={mockQuiz.moduleName}
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learning', href: '/learning' },
            { label: mockQuiz.moduleName, href: `/learning/${mockQuiz.moduleSlug}` },
            { label: 'Quiz' },
          ]}
        />

        <PageShell>
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card variant="glow">
                <CardContent className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center bg-[var(--accent-primary-glow)]">
                    <Trophy className="w-10 h-10 text-[var(--accent-primary)]" />
                  </div>

                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                    {mockQuiz.title}
                  </h2>
                  <p className="text-[var(--text-secondary)] mb-8">
                    {mockQuiz.description}
                  </p>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {mockQuiz.questions.length}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">Questions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {formatTime(mockQuiz.timeLimit)}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">Time Limit</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[var(--accent-primary)]">
                        {mockQuiz.passingScore}%
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">To Pass</p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setQuizStarted(true)}
                    className="px-12"
                  >
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
  if (showResults) {
    const score = calculateScore();
    const passed = score.percentage >= mockQuiz.passingScore;

    return (
      <>
        <Header
          title="Quiz Results"
          subtitle={mockQuiz.title}
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learning', href: '/learning' },
            { label: mockQuiz.moduleName, href: `/learning/${mockQuiz.moduleSlug}` },
            { label: 'Quiz Results' },
          ]}
        />

        <PageShell>
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card variant="glow">
                <CardContent className="text-center py-12">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                  >
                    <CircularProgress
                      value={score.percentage}
                      size={160}
                      strokeWidth={12}
                      variant={passed ? 'success' : 'default'}
                      className="mx-auto mb-6"
                    />
                  </motion.div>

                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                    {passed ? 'Congratulations!' : 'Keep Practicing!'}
                  </h2>
                  <p className="text-[var(--text-secondary)] mb-6">
                    You scored {score.correct} out of {score.total} (
                    {score.percentage}%)
                  </p>

                  <Badge
                    variant={passed ? 'success' : 'warning'}
                    size="lg"
                    className="mb-8"
                  >
                    {passed ? 'PASSED' : 'NOT PASSED'}
                  </Badge>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-[var(--bg-tertiary)]">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-[var(--profit)]" />
                        <span className="text-xl font-bold text-[var(--profit)]">
                          {score.correct}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">Correct</p>
                    </div>
                    <div className="p-4 bg-[var(--bg-tertiary)]">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-[var(--loss)]" />
                        <span className="text-xl font-bold text-[var(--loss)]">
                          {score.total - score.correct}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">Incorrect</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <Button
                      variant="secondary"
                      icon={<RotateCcw className="w-4 h-4" />}
                      onClick={handleRetake}
                    >
                      Retake Quiz
                    </Button>
                    <Link href={`/learning/${mockQuiz.moduleSlug}`}>
                      <Button variant="primary" icon={<Home className="w-4 h-4" />}>
                        Back to Module
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Question Review */}
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Review Answers
                </h3>
                {mockQuiz.questions.map((q, index) => {
                  const userAnswer = selectedAnswers[q.id];
                  const isCorrect = userAnswer === q.correctOptionId;

                  return (
                    <Card key={q.id}>
                      <CardContent>
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-8 h-8 flex items-center justify-center flex-shrink-0',
                              isCorrect
                                ? 'bg-[rgba(34,197,94,0.15)] text-[var(--profit)]'
                                : 'bg-[rgba(239,68,68,0.15)] text-[var(--loss)]'
                            )}
                          >
                            {isCorrect ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <XCircle className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-[var(--text-muted)] mb-1">
                              Question {index + 1}
                            </p>
                            <p className="font-medium text-[var(--text-primary)] mb-2">
                              {q.question}
                            </p>
                            <p className="text-sm text-[var(--text-secondary)]">
                              <span className="text-[var(--profit)]">Correct: </span>
                              {q.options.find((o) => o.id === q.correctOptionId)?.text}
                            </p>
                            {!isCorrect && userAnswer && (
                              <p className="text-sm text-[var(--text-secondary)]">
                                <span className="text-[var(--loss)]">Your answer: </span>
                                {q.options.find((o) => o.id === userAnswer)?.text}
                              </p>
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
        title={`Question ${currentQuestionIndex + 1} of ${mockQuiz.questions.length}`}
        subtitle={mockQuiz.title}
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learning', href: '/learning' },
          { label: mockQuiz.moduleName, href: `/learning/${mockQuiz.moduleSlug}` },
          { label: 'Quiz' },
        ]}
      />

      <PageShell>
        <div className="max-w-2xl mx-auto">
          {/* Timer and Progress */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock
                      className={cn(
                        'w-5 h-5',
                        timeRemaining < 60
                          ? 'text-[var(--loss)]'
                          : 'text-[var(--text-secondary)]'
                      )}
                    />
                    <span
                      className={cn(
                        'font-mono text-lg font-bold',
                        timeRemaining < 60
                          ? 'text-[var(--loss)]'
                          : 'text-[var(--text-primary)]'
                      )}
                    >
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">
                    {currentQuestionIndex + 1}/{mockQuiz.questions.length}
                  </span>
                </div>
                <ProgressBar
                  value={((currentQuestionIndex + 1) / mockQuiz.questions.length) * 100}
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
                      const isCorrectOption =
                        option.id === currentQuestion.correctOptionId;
                      const showCorrect = showExplanation && isCorrectOption;
                      const showIncorrect =
                        showExplanation && isSelected && !isCorrectOption;

                      return (
                        <motion.button
                          key={option.id}
                          onClick={() => handleSelectAnswer(option.id)}
                          disabled={showExplanation}
                          whileHover={!showExplanation ? { scale: 1.01 } : {}}
                          whileTap={!showExplanation ? { scale: 0.99 } : {}}
                          className={cn(
                            'w-full p-4 text-left transition-all duration-150',
                            'border',
                            showCorrect
                              ? 'bg-[rgba(34,197,94,0.15)] border-[var(--profit)] text-[var(--text-primary)]'
                              : showIncorrect
                              ? 'bg-[rgba(239,68,68,0.15)] border-[var(--loss)] text-[var(--text-primary)]'
                              : isSelected
                              ? 'bg-[var(--accent-primary-glow)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                              : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-secondary)]'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'w-8 h-8 flex items-center justify-center text-sm font-medium',
                                showCorrect
                                  ? 'bg-[var(--profit)] text-white'
                                  : showIncorrect
                                  ? 'bg-[var(--loss)] text-white'
                                  : isSelected
                                  ? 'bg-[var(--accent-primary)] text-black'
                                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                              )}
                            >
                              {option.id.toUpperCase()}
                            </span>
                            <span className="flex-1">{option.text}</span>
                            {showCorrect && (
                              <CheckCircle2 className="w-5 h-5 text-[var(--profit)]" />
                            )}
                            {showIncorrect && (
                              <XCircle className="w-5 h-5 text-[var(--loss)]" />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  <AnimatePresence>
                    {showExplanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 p-4 bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent-primary)]"
                      >
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-[var(--text-primary)] mb-1">
                              Explanation
                            </p>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {currentQuestion.explanation}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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

                  {!showExplanation ? (
                    <Button
                      variant="primary"
                      onClick={handleCheckAnswer}
                      disabled={!selectedAnswer}
                    >
                      Check Answer
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleNextQuestion}
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      {currentQuestionIndex === mockQuiz.questions.length - 1
                        ? 'See Results'
                        : 'Next Question'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </PageShell>
    </>
  );
}
