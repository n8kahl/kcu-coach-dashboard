/**
 * Daily Challenges API
 *
 * GET /api/practice/challenges - Get today's challenges with user progress
 * POST /api/practice/challenges - Update challenge progress
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

// Type definitions
interface Challenge {
  id: string;
  challenge_date: string;
  challenge_type: string;
  title: string;
  description: string;
  target_count: number;
  target_accuracy: number;
  time_limit_seconds: number | null;
  xp_reward: number;
  badge_reward: string | null;
  is_active: boolean;
}

interface ChallengeProgress {
  id: string;
  user_id: string;
  challenge_id: string;
  attempts_completed: number;
  correct_completed: number;
  total_time_seconds: number;
  completed_at: string | null;
  xp_awarded: number;
}

/**
 * GET /api/practice/challenges
 * Get today's challenges with user progress
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get today's challenges
    const { data: challenges, error: challengesError } = await supabaseAdmin
      .from('practice_challenges')
      .select('*')
      .eq('challenge_date', today)
      .eq('is_active', true);

    if (challengesError) {
      logger.error('Error fetching challenges', { error: challengesError.message });
      return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 });
    }

    // If no challenges for today, create default ones
    if (!challenges || challenges.length === 0) {
      await createDailyChallenges(today);

      const { data: newChallenges } = await supabaseAdmin
        .from('practice_challenges')
        .select('*')
        .eq('challenge_date', today)
        .eq('is_active', true);

      if (newChallenges) {
        challenges.push(...newChallenges);
      }
    }

    // Get user's progress for each challenge
    const challengeIds = (challenges as Challenge[])?.map((c: Challenge) => c.id) || [];
    const { data: progress } = await supabaseAdmin
      .from('practice_challenge_progress')
      .select('*')
      .eq('user_id', session.userId)
      .in('challenge_id', challengeIds);

    const progressMap = new Map(
      (progress as ChallengeProgress[])?.map((p: ChallengeProgress) => [p.challenge_id, p]) || []
    );

    // Merge challenges with progress
    const challengesWithProgress = (challenges as Challenge[])?.map((challenge: Challenge) => {
      const userProgress = progressMap.get(challenge.id) as ChallengeProgress | undefined;
      return {
        id: challenge.id,
        type: challenge.challenge_type,
        title: challenge.title,
        description: challenge.description,
        targetCount: challenge.target_count,
        targetAccuracy: challenge.target_accuracy,
        timeLimitSeconds: challenge.time_limit_seconds,
        xpReward: challenge.xp_reward,
        badgeReward: challenge.badge_reward,
        // Progress
        attemptsCompleted: userProgress?.attempts_completed || 0,
        correctCompleted: userProgress?.correct_completed || 0,
        totalTimeSeconds: userProgress?.total_time_seconds || 0,
        completed: !!userProgress?.completed_at,
        completedAt: userProgress?.completed_at,
        xpAwarded: userProgress?.xp_awarded || 0,
        // Calculate progress percentage
        progressPercent: calculateProgressPercent(challenge, userProgress),
      };
    });

    // Get user's XP info
    const { data: xpData } = await supabaseAdmin
      .from('user_practice_xp')
      .select('*')
      .eq('user_id', session.userId)
      .single();

    return NextResponse.json({
      challenges: challengesWithProgress || [],
      date: today,
      userXp: xpData
        ? {
            totalXp: xpData.total_xp,
            currentLevel: xpData.current_level,
            xpToNextLevel: xpData.xp_to_next_level,
            unlockedDifficulties: xpData.unlocked_difficulties,
          }
        : {
            totalXp: 0,
            currentLevel: 1,
            xpToNextLevel: 100,
            unlockedDifficulties: ['beginner'],
          },
    });
  } catch (error) {
    logger.error('Error in challenges GET', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/practice/challenges
 * Update challenge progress after a practice attempt
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { challengeId, attemptResult, timeSeconds } = body;

    if (!challengeId) {
      return NextResponse.json({ error: 'challengeId is required' }, { status: 400 });
    }

    // Get the challenge
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from('practice_challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Get or create progress record
    let { data: progress } = await supabaseAdmin
      .from('practice_challenge_progress')
      .select('*')
      .eq('user_id', session.userId)
      .eq('challenge_id', challengeId)
      .single();

    if (!progress) {
      const { data: newProgress, error: createError } = await supabaseAdmin
        .from('practice_challenge_progress')
        .insert({
          user_id: session.userId,
          challenge_id: challengeId,
        })
        .select()
        .single();

      if (createError) {
        logger.error('Error creating progress', { error: createError.message });
        return NextResponse.json({ error: 'Failed to create progress' }, { status: 500 });
      }

      progress = newProgress;
    }

    // Check if already completed
    if (progress.completed_at) {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        progress: progress,
      });
    }

    // Update progress
    const newAttemptsCompleted = progress.attempts_completed + 1;
    const newCorrectCompleted = progress.correct_completed + (attemptResult?.isCorrect ? 1 : 0);
    const newTotalTime = progress.total_time_seconds + (timeSeconds || 0);

    // Check if challenge is now completed
    const isCompleted = checkChallengeCompletion(challenge, {
      attemptsCompleted: newAttemptsCompleted,
      correctCompleted: newCorrectCompleted,
      totalTimeSeconds: newTotalTime,
    });

    const updateData: {
      attempts_completed: number;
      correct_completed: number;
      total_time_seconds: number;
      completed_at?: string;
      xp_awarded?: number;
    } = {
      attempts_completed: newAttemptsCompleted,
      correct_completed: newCorrectCompleted,
      total_time_seconds: newTotalTime,
    };

    if (isCompleted) {
      updateData.completed_at = new Date().toISOString();
      updateData.xp_awarded = challenge.xp_reward;

      // Award XP
      await supabaseAdmin.rpc('award_xp', {
        p_user_id: session.userId,
        p_xp_amount: challenge.xp_reward,
      });

      // Award achievement if badge reward
      if (challenge.badge_reward) {
        await supabaseAdmin.from('practice_achievements').upsert(
          {
            user_id: session.userId,
            achievement_type: challenge.badge_reward,
            context: { challenge_id: challengeId, challenge_type: challenge.challenge_type },
          },
          { onConflict: 'user_id,achievement_type,achievement_tier' }
        );
      }
    }

    const { data: updatedProgress, error: updateError } = await supabaseAdmin
      .from('practice_challenge_progress')
      .update(updateData)
      .eq('id', progress.id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating progress', { error: updateError.message });
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }

    logger.info('Challenge progress updated', {
      userId: session.userId,
      challengeId,
      completed: isCompleted,
    });

    return NextResponse.json({
      success: true,
      progress: {
        attemptsCompleted: updatedProgress.attempts_completed,
        correctCompleted: updatedProgress.correct_completed,
        totalTimeSeconds: updatedProgress.total_time_seconds,
        completed: !!updatedProgress.completed_at,
        xpAwarded: updatedProgress.xp_awarded,
      },
      justCompleted: isCompleted,
      xpEarned: isCompleted ? challenge.xp_reward : 0,
    });
  } catch (error) {
    logger.error('Error in challenges POST', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Create default daily challenges
 */
async function createDailyChallenges(date: string) {
  const challenges = [
    {
      challenge_date: date,
      challenge_type: 'daily_practice',
      title: 'Daily Practice',
      description: 'Complete 5 practice scenarios today',
      target_count: 5,
      target_accuracy: 0,
      xp_reward: 50,
    },
    {
      challenge_date: date,
      challenge_type: 'accuracy_target',
      title: 'Accuracy Master',
      description: 'Achieve 80% accuracy on 10 scenarios',
      target_count: 10,
      target_accuracy: 80,
      xp_reward: 100,
    },
    {
      challenge_date: date,
      challenge_type: 'level_focus',
      title: 'Level Expert',
      description: 'Practice 5 level-focused scenarios',
      target_count: 5,
      target_accuracy: 0,
      xp_reward: 75,
      scenario_requirements: { focus_area: 'level' },
    },
  ];

  for (const challenge of challenges) {
    await supabaseAdmin
      .from('practice_challenges')
      .upsert(challenge, { onConflict: 'challenge_date,challenge_type' });
  }
}

/**
 * Calculate progress percentage for a challenge
 */
function calculateProgressPercent(
  challenge: { target_count: number; target_accuracy: number },
  progress?: { attempts_completed: number; correct_completed: number }
): number {
  if (!progress) return 0;

  if (challenge.target_accuracy > 0) {
    // Accuracy challenge: need both count and accuracy
    const countProgress = Math.min(100, (progress.attempts_completed / challenge.target_count) * 100);
    const accuracy =
      progress.attempts_completed > 0
        ? (progress.correct_completed / progress.attempts_completed) * 100
        : 0;
    const accuracyProgress = Math.min(100, (accuracy / challenge.target_accuracy) * 100);
    return Math.min(countProgress, accuracyProgress);
  }

  // Count-only challenge
  return Math.min(100, (progress.attempts_completed / challenge.target_count) * 100);
}

/**
 * Check if a challenge is completed
 */
function checkChallengeCompletion(
  challenge: { target_count: number; target_accuracy: number },
  progress: { attemptsCompleted: number; correctCompleted: number; totalTimeSeconds: number }
): boolean {
  // Must meet target count
  if (progress.attemptsCompleted < challenge.target_count) {
    return false;
  }

  // If accuracy target, check accuracy
  if (challenge.target_accuracy > 0) {
    const accuracy = (progress.correctCompleted / progress.attemptsCompleted) * 100;
    return accuracy >= challenge.target_accuracy;
  }

  return true;
}
