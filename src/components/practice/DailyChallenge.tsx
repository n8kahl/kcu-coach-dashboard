'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Target,
  Zap,
  Clock,
  CheckCircle,
  Flame,
  Star,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface Challenge {
  id: string;
  type: string;
  title: string;
  description: string;
  targetCount: number;
  targetAccuracy: number;
  timeLimitSeconds: number | null;
  xpReward: number;
  badgeReward: string | null;
  attemptsCompleted: number;
  correctCompleted: number;
  completed: boolean;
  completedAt: string | null;
  xpAwarded: number;
  progressPercent: number;
}

interface UserXp {
  totalXp: number;
  currentLevel: number;
  xpToNextLevel: number;
  unlockedDifficulties: string[];
}

interface DailyChallengesProps {
  onStartChallenge?: (challengeId: string, type: string) => void;
  className?: string;
}

export function DailyChallenges({ onStartChallenge, className }: DailyChallengesProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userXp, setUserXp] = useState<UserXp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch challenges
  useEffect(() => {
    async function fetchChallenges() {
      try {
        setLoading(true);
        const res = await fetch('/api/practice/challenges');
        if (res.ok) {
          const data = await res.json();
          setChallenges(data.challenges || []);
          setUserXp(data.userXp);
          setError(null);
        } else {
          // Use mock data for development/when API fails
          setChallenges([
            {
              id: 'mock-1',
              type: 'daily_practice',
              title: 'Daily Practice',
              description: 'Complete 5 practice scenarios today',
              targetCount: 5,
              targetAccuracy: 0,
              timeLimitSeconds: null,
              xpReward: 50,
              badgeReward: null,
              attemptsCompleted: 2,
              correctCompleted: 1,
              completed: false,
              completedAt: null,
              xpAwarded: 0,
              progressPercent: 40,
            },
            {
              id: 'mock-2',
              type: 'accuracy_target',
              title: 'Accuracy Master',
              description: 'Achieve 80% accuracy on 10 scenarios',
              targetCount: 10,
              targetAccuracy: 80,
              timeLimitSeconds: null,
              xpReward: 100,
              badgeReward: 'accuracy_badge',
              attemptsCompleted: 3,
              correctCompleted: 2,
              completed: false,
              completedAt: null,
              xpAwarded: 0,
              progressPercent: 30,
            },
            {
              id: 'mock-3',
              type: 'level_focus',
              title: 'Level Expert',
              description: 'Practice 5 level-focused scenarios',
              targetCount: 5,
              targetAccuracy: 0,
              timeLimitSeconds: null,
              xpReward: 75,
              badgeReward: null,
              attemptsCompleted: 1,
              correctCompleted: 1,
              completed: false,
              completedAt: null,
              xpAwarded: 0,
              progressPercent: 20,
            },
          ]);
          setUserXp({
            totalXp: 250,
            currentLevel: 3,
            xpToNextLevel: 50,
            unlockedDifficulties: ['beginner', 'intermediate'],
          });
          setError(null);
        }
      } catch (err) {
        // Use mock data on error
        setChallenges([
          {
            id: 'mock-1',
            type: 'daily_practice',
            title: 'Daily Practice',
            description: 'Complete 5 practice scenarios today',
            targetCount: 5,
            targetAccuracy: 0,
            timeLimitSeconds: null,
            xpReward: 50,
            badgeReward: null,
            attemptsCompleted: 2,
            correctCompleted: 1,
            completed: false,
            completedAt: null,
            xpAwarded: 0,
            progressPercent: 40,
          },
          {
            id: 'mock-2',
            type: 'accuracy_target',
            title: 'Accuracy Master',
            description: 'Achieve 80% accuracy on 10 scenarios',
            targetCount: 10,
            targetAccuracy: 80,
            timeLimitSeconds: null,
            xpReward: 100,
            badgeReward: 'accuracy_badge',
            attemptsCompleted: 3,
            correctCompleted: 2,
            completed: false,
            completedAt: null,
            xpAwarded: 0,
            progressPercent: 30,
          },
        ]);
        setUserXp({
          totalXp: 250,
          currentLevel: 3,
          xpToNextLevel: 50,
          unlockedDifficulties: ['beginner', 'intermediate'],
        });
        setError(null);
      } finally {
        setLoading(false);
      }
    }

    fetchChallenges();
  }, []);

  // Get icon for challenge type
  const getChallengeIcon = (type: string) => {
    switch (type) {
      case 'daily_practice':
        return <Target className="w-5 h-5" />;
      case 'accuracy_target':
        return <Trophy className="w-5 h-5" />;
      case 'speed_run':
        return <Zap className="w-5 h-5" />;
      case 'level_focus':
      case 'trend_focus':
      case 'patience_focus':
        return <Star className="w-5 h-5" />;
      default:
        return <Flame className="w-5 h-5" />;
    }
  };

  // Get color for challenge type
  const getChallengeColor = (type: string, completed: boolean) => {
    if (completed) return 'success';
    switch (type) {
      case 'daily_practice':
        return 'info';
      case 'accuracy_target':
        return 'warning';
      case 'speed_run':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--accent-primary)]" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-[var(--text-tertiary)]">
          {error}
        </CardContent>
      </Card>
    );
  }

  const completedCount = challenges.filter((c) => c.completed).length;
  const totalXpAvailable = challenges.reduce((sum, c) => sum + c.xpReward, 0);
  const totalXpEarned = challenges.reduce((sum, c) => sum + c.xpAwarded, 0);

  return (
    <Card className={className}>
      <CardHeader
        title="Daily Challenges"
        icon={<Flame className="w-5 h-5 text-[var(--warning)]" />}
        subtitle={`${completedCount}/${challenges.length} completed`}
        action={
          userXp && (
            <div className="flex items-center gap-2">
              <Badge variant="info" size="sm">
                Level {userXp.currentLevel}
              </Badge>
              <span className="text-xs text-[var(--text-tertiary)]">
                {userXp.totalXp} XP
              </span>
            </div>
          )
        }
      />
      <CardContent className="p-0">
        {/* XP Progress to Next Level */}
        {userXp && (
          <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--text-tertiary)]">
                Level {userXp.currentLevel} Progress
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {userXp.xpToNextLevel} XP to Level {userXp.currentLevel + 1}
              </span>
            </div>
            <ProgressBar
              value={100 - (userXp.xpToNextLevel / ((userXp.currentLevel + 1) * 50)) * 100}
              max={100}
              size="sm"
              variant="gold"
            />
          </div>
        )}

        {/* Challenge List */}
        <div className="divide-y divide-[var(--border-primary)]">
          {challenges.map((challenge) => (
            <div
              key={challenge.id}
              className={cn(
                'px-4 py-3 hover:bg-[var(--bg-tertiary)] transition-colors',
                challenge.completed && 'bg-[var(--success)]/5'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    'p-2 rounded-lg',
                    challenge.completed
                      ? 'bg-[var(--success)]/20 text-[var(--success)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                  )}
                >
                  {challenge.completed ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    getChallengeIcon(challenge.type)
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        'font-medium',
                        challenge.completed
                          ? 'text-[var(--success)]'
                          : 'text-[var(--text-primary)]'
                      )}
                    >
                      {challenge.title}
                    </span>
                    <Badge
                      variant={getChallengeColor(challenge.type, challenge.completed)}
                      size="sm"
                    >
                      +{challenge.xpReward} XP
                    </Badge>
                  </div>

                  <p className="text-sm text-[var(--text-secondary)] mb-2">
                    {challenge.description}
                  </p>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-tertiary)]">
                        {challenge.attemptsCompleted}/{challenge.targetCount} attempts
                        {challenge.targetAccuracy > 0 && (
                          <span className="ml-2">
                            ({challenge.correctCompleted > 0
                              ? Math.round(
                                  (challenge.correctCompleted / challenge.attemptsCompleted) * 100
                                )
                              : 0}
                            /{challenge.targetAccuracy}% accuracy)
                          </span>
                        )}
                      </span>
                      {challenge.timeLimitSeconds && (
                        <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                          <Clock className="w-3 h-3" />
                          {Math.floor(challenge.timeLimitSeconds / 60)}m limit
                        </span>
                      )}
                    </div>
                    <ProgressBar
                      value={challenge.progressPercent}
                      max={100}
                      size="sm"
                      variant={challenge.completed ? 'success' : 'default'}
                    />
                  </div>
                </div>

                {/* Action */}
                {!challenge.completed && onStartChallenge && (
                  <button
                    onClick={() => onStartChallenge(challenge.id, challenge.type)}
                    className="p-2 rounded hover:bg-[var(--bg-tertiary)] text-[var(--accent-primary)]"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="px-4 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">
              {completedCount === challenges.length ? (
                <span className="flex items-center gap-1 text-[var(--success)]">
                  <Trophy className="w-4 h-4" />
                  All challenges completed!
                </span>
              ) : (
                `${totalXpAvailable - totalXpEarned} XP remaining today`
              )}
            </span>
            <span className="text-sm font-semibold text-[var(--accent-primary)]">
              {totalXpEarned} / {totalXpAvailable} XP earned
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DailyChallenges;
