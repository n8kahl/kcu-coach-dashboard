'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stat, StatGrid } from '@/components/ui/stat';
import { ProgressBar } from '@/components/ui/progress';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Trophy,
  ChevronRight,
  Loader2,
  BarChart3,
  RefreshCw,
} from 'lucide-react';

interface Scenario {
  id: string;
  title: string;
  description: string;
  symbol: string;
  scenario_type: string;
  difficulty: string;
  tags: string[];
  userAttempts: number;
  userCorrect: number;
}

interface ScenarioDetail {
  id: string;
  title: string;
  description: string;
  symbol: string;
  scenarioType: string;
  difficulty: string;
  chartData: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
  keyLevels: Array<{ price: number; type: string; strength: number }>;
  hasAttempted: boolean;
  correctAction?: string;
  outcomeData?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
  ltpAnalysis?: {
    levelScore: number;
    trendScore: number;
    patienceScore: number;
    overallGrade: string;
  };
  explanation?: string;
  lastAttempt?: {
    decision: string;
    isCorrect: boolean;
    feedback: string;
  };
}

interface UserStats {
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercent: number;
  uniqueScenarios: number;
}

export default function PracticePage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDetail | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    feedback: string;
    correctAction: string;
  } | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const fetchScenarios = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (difficultyFilter) params.append('difficulty', difficultyFilter);
      if (typeFilter) params.append('type', typeFilter);

      const res = await fetch(`/api/practice/scenarios?${params}`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    }
  }, [difficultyFilter, typeFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/practice/submit');
      if (res.ok) {
        const data = await res.json();
        setUserStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchScenarios(), fetchStats()]);
      setLoading(false);
    }
    init();
  }, [fetchScenarios, fetchStats]);

  const selectScenario = async (id: string) => {
    setScenarioLoading(true);
    setResult(null);
    setStartTime(Date.now());

    try {
      const res = await fetch(`/api/practice/scenarios/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedScenario(data);
      }
    } catch (error) {
      console.error('Error fetching scenario:', error);
    } finally {
      setScenarioLoading(false);
    }
  };

  const submitDecision = async (decision: 'long' | 'short' | 'wait') => {
    if (!selectedScenario) return;

    setSubmitting(true);
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined;

    try {
      const res = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: selectedScenario.id,
          decision,
          timeTakenSeconds: timeTaken,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult({
          isCorrect: data.attempt.isCorrect,
          feedback: data.attempt.feedback,
          correctAction: data.correctAction,
        });

        // Update the scenario with outcome data
        setSelectedScenario(prev => prev ? {
          ...prev,
          correctAction: data.correctAction,
          outcomeData: data.outcomeData,
          ltpAnalysis: data.ltpAnalysis,
          explanation: data.explanation,
          hasAttempted: true,
        } : null);

        // Update stats
        if (data.userStats) {
          setUserStats(data.userStats);
        } else {
          fetchStats();
        }

        // Refresh scenarios list
        fetchScenarios();
      }
    } catch (error) {
      console.error('Error submitting decision:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reversal': return <RefreshCw className="w-4 h-4" />;
      case 'breakout': return <TrendingUp className="w-4 h-4" />;
      case 'continuation': return <ChevronRight className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <>
      <Header
        title="Practice Simulator"
        subtitle="Test your LTP framework skills with real market scenarios"
        breadcrumbs={[{ label: 'Practice' }]}
      />

      <PageShell>
        {/* User Stats */}
        <PageSection>
          <StatGrid columns={4}>
            <Card padding="md">
              <Stat
                label="Total Attempts"
                value={userStats?.totalAttempts || 0}
                icon={<Target className="w-4 h-4" />}
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Correct"
                value={userStats?.correctAttempts || 0}
                icon={<CheckCircle className="w-4 h-4" />}
                valueColor="profit"
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Accuracy"
                value={`${userStats?.accuracyPercent || 0}%`}
                icon={<Trophy className="w-4 h-4" />}
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Scenarios Tried"
                value={userStats?.uniqueScenarios || 0}
                icon={<BarChart3 className="w-4 h-4" />}
              />
            </Card>
          </StatGrid>
        </PageSection>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scenario List */}
          <PageSection className="lg:col-span-1">
            <Card>
              <CardHeader
                title="Scenarios"
                action={
                  <div className="flex gap-2">
                    <select
                      className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1"
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                    >
                      <option value="">All Levels</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                }
              />
              <CardContent className="p-0">
                <div className="divide-y divide-[var(--border-primary)] max-h-[500px] overflow-y-auto">
                  {scenarios.length === 0 ? (
                    <div className="p-6 text-center text-[var(--text-tertiary)]">
                      No scenarios available yet.
                    </div>
                  ) : (
                    scenarios.map((scenario) => (
                      <button
                        key={scenario.id}
                        className={`w-full p-4 text-left hover:bg-[var(--bg-tertiary)] transition-colors ${
                          selectedScenario?.id === scenario.id ? 'bg-[var(--bg-tertiary)]' : ''
                        }`}
                        onClick={() => selectScenario(scenario.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getTypeIcon(scenario.scenario_type)}
                              <span className="font-medium text-[var(--text-primary)]">
                                {scenario.symbol}
                              </span>
                              <Badge variant={getDifficultyColor(scenario.difficulty)} size="sm">
                                {scenario.difficulty}
                              </Badge>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] line-clamp-1">
                              {scenario.title}
                            </p>
                          </div>
                          {scenario.userAttempts > 0 && (
                            <div className="text-right">
                              <span className={`text-xs ${
                                scenario.userCorrect > 0 ? 'text-[var(--profit)]' : 'text-[var(--text-tertiary)]'
                              }`}>
                                {scenario.userCorrect}/{scenario.userAttempts}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </PageSection>

          {/* Scenario Detail / Practice Area */}
          <PageSection className="lg:col-span-2">
            <Card>
              {scenarioLoading ? (
                <CardContent className="py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)] mx-auto" />
                </CardContent>
              ) : selectedScenario ? (
                <>
                  <CardHeader
                    title={selectedScenario.title}
                    subtitle={selectedScenario.description}
                  />
                  <CardContent>
                    {/* Chart Placeholder - In a real implementation, render actual chart */}
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-6 mb-6">
                      <div className="aspect-video bg-[var(--bg-primary)] rounded border border-[var(--border-primary)] flex items-center justify-center">
                        <div className="text-center text-[var(--text-tertiary)]">
                          <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Chart visualization would render here</p>
                          <p className="text-sm mt-1">
                            {selectedScenario.chartData?.length || 0} bars |
                            {selectedScenario.keyLevels?.length || 0} key levels
                          </p>
                        </div>
                      </div>

                      {/* Key Levels */}
                      {selectedScenario.keyLevels && selectedScenario.keyLevels.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedScenario.keyLevels.map((level, i) => (
                            <Badge
                              key={i}
                              variant={level.type === 'support' ? 'success' : 'error'}
                              size="sm"
                            >
                              {level.type}: ${level.price.toFixed(2)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Decision Buttons or Result */}
                    {result ? (
                      <div className={`p-6 rounded-lg ${
                        result.isCorrect
                          ? 'bg-[var(--profit)]/10 border border-[var(--profit)]'
                          : 'bg-[var(--loss)]/10 border border-[var(--loss)]'
                      }`}>
                        <div className="flex items-center gap-3 mb-4">
                          {result.isCorrect ? (
                            <CheckCircle className="w-8 h-8 text-[var(--profit)]" />
                          ) : (
                            <XCircle className="w-8 h-8 text-[var(--loss)]" />
                          )}
                          <div>
                            <h3 className={`text-lg font-bold ${
                              result.isCorrect ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
                            }`}>
                              {result.isCorrect ? 'Correct!' : 'Incorrect'}
                            </h3>
                            <p className="text-sm text-[var(--text-secondary)]">
                              Correct action: <span className="font-semibold uppercase">{result.correctAction}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-sm text-[var(--text-secondary)] whitespace-pre-line">
                          {result.feedback}
                        </div>

                        {/* LTP Analysis */}
                        {selectedScenario.ltpAnalysis && (
                          <div className="mt-4 grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)] mb-1">Level Score</p>
                              <ProgressBar
                                value={selectedScenario.ltpAnalysis.levelScore}
                                max={100}
                                size="sm"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)] mb-1">Trend Score</p>
                              <ProgressBar
                                value={selectedScenario.ltpAnalysis.trendScore}
                                max={100}
                                size="sm"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)] mb-1">Patience Score</p>
                              <ProgressBar
                                value={selectedScenario.ltpAnalysis.patienceScore}
                                max={100}
                                size="sm"
                              />
                            </div>
                          </div>
                        )}

                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-4"
                          onClick={() => {
                            setSelectedScenario(null);
                            setResult(null);
                          }}
                        >
                          Try Another
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-center text-[var(--text-secondary)] mb-6">
                          Based on the LTP framework, what is the best action?
                        </p>

                        <div className="grid grid-cols-3 gap-4">
                          <Button
                            variant="secondary"
                            size="lg"
                            className="flex-col py-6 hover:bg-[var(--profit)]/20 hover:border-[var(--profit)]"
                            onClick={() => submitDecision('long')}
                            disabled={submitting}
                          >
                            <TrendingUp className="w-8 h-8 mb-2 text-[var(--profit)]" />
                            <span className="text-lg font-bold">LONG</span>
                          </Button>

                          <Button
                            variant="secondary"
                            size="lg"
                            className="flex-col py-6 hover:bg-[var(--warning)]/20 hover:border-[var(--warning)]"
                            onClick={() => submitDecision('wait')}
                            disabled={submitting}
                          >
                            <Pause className="w-8 h-8 mb-2 text-[var(--warning)]" />
                            <span className="text-lg font-bold">WAIT</span>
                          </Button>

                          <Button
                            variant="secondary"
                            size="lg"
                            className="flex-col py-6 hover:bg-[var(--loss)]/20 hover:border-[var(--loss)]"
                            onClick={() => submitDecision('short')}
                            disabled={submitting}
                          >
                            <TrendingDown className="w-8 h-8 mb-2 text-[var(--loss)]" />
                            <span className="text-lg font-bold">SHORT</span>
                          </Button>
                        </div>

                        {submitting && (
                          <div className="text-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)] mx-auto" />
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </>
              ) : (
                <CardContent className="py-20 text-center">
                  <Target className="w-16 h-16 mx-auto mb-4 text-[var(--text-tertiary)] opacity-50" />
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    Select a Scenario
                  </h3>
                  <p className="text-[var(--text-tertiary)]">
                    Choose a practice scenario from the list to test your LTP skills.
                  </p>
                </CardContent>
              )}
            </Card>
          </PageSection>
        </div>
      </PageShell>
    </>
  );
}
