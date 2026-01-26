/**
 * Practice AI Coach
 *
 * Provides AI-powered coaching feedback for practice scenarios,
 * integrating with the Claude API to generate personalized guidance.
 */

import Anthropic from '@anthropic-ai/sdk';
import logger from './logger';

const anthropic = new Anthropic();

interface LTPAnalysis {
  level: { score: number; reason: string };
  trend: { score: number; reason: string };
  patience: { score: number; reason: string };
}

interface ScenarioData {
  title: string;
  description: string;
  symbol: string;
  scenarioType: string;
  difficulty: string;
  correctAction: 'long' | 'short' | 'wait';
  ltpAnalysis: LTPAnalysis;
  explanation: string;
  keyLevels: Array<{ type: string; price: number; label: string }>;
  tags: string[];
  focusArea?: string;
  relatedLessonSlug?: string;
}

interface UserAttempt {
  decision: 'long' | 'short' | 'wait';
  reasoning?: string;
  ltpChecklist?: {
    levelScore?: number;
    trendScore?: number;
    patienceScore?: number;
    notes?: string;
  };
  timeTakenSeconds?: number;
  emotionTag?: string;
}

interface UserContext {
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercent: number;
  currentStreak: number;
  recentMistakes?: Array<{
    scenarioType: string;
    mistakePattern: string;
  }>;
  weakAreas?: string[];
}

interface CoachingFeedback {
  isCorrect: boolean;
  summary: string;
  detailedFeedback: string;
  ltpBreakdown: {
    level: string;
    trend: string;
    patience: string;
  };
  whatYouMissed?: string;
  encouragement: string;
  richContent?: string; // [[LESSON:...]] markers
  nextSteps: string[];
  personalizedTip?: string;
}

const COACHING_SYSTEM_PROMPT = `You are an expert LTP (Level-Trend-Patience) trading coach for KCU (Kings Corner University). Your role is to provide supportive, educational feedback on practice trading scenarios.

LTP Framework Overview:
- LEVEL: Key price zones where buyers/sellers have shown interest (support, resistance, VWAP, PDH/PDL, ORB levels)
- TREND: Market direction and momentum (above/below VWAP, moving average alignment, higher highs/lows)
- PATIENCE: Confirmation signals showing the level will hold (multiple candle tests, volume patterns, absorption)

Your feedback style:
1. Be supportive but honest - celebrate correct decisions, gently correct mistakes
2. Focus on the "why" not just "what" - help users understand the reasoning
3. Reference specific LTP components when explaining
4. Use real price levels and specific observations from the scenario
5. Suggest relevant lessons when appropriate (use [[LESSON:module/lesson|Title|Duration]] format)
6. Keep feedback concise but educational
7. Adjust tone based on user's experience level and streak

Rich content markers you can use:
- [[LESSON:ltp-framework/level-identification|Level Identification|15 min]] - Link to lessons
- [[COURSE:ltp-framework/core-concepts/patience-candles|120|Patience Candles]] - Course video with timestamp

Never be harsh or discouraging. Trading is hard, and every mistake is a learning opportunity.`;

/**
 * Generate AI coaching feedback for a practice attempt
 */
export async function generateAICoachingFeedback(
  scenario: ScenarioData,
  attempt: UserAttempt,
  userContext?: UserContext
): Promise<CoachingFeedback> {
  const isCorrect = attempt.decision === scenario.correctAction;

  // Build the prompt
  const prompt = buildCoachingPrompt(scenario, attempt, userContext, isCorrect);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: COACHING_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Parse the response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const feedback = parseCoachingResponse(content.text, isCorrect, scenario);
    return feedback;
  } catch (error) {
    logger.error('Error generating AI coaching feedback', {
      error: error instanceof Error ? error.message : String(error),
      scenario: scenario.title,
    });

    // Return fallback feedback
    return generateFallbackFeedback(scenario, attempt, isCorrect);
  }
}

/**
 * Build the coaching prompt with all context
 */
function buildCoachingPrompt(
  scenario: ScenarioData,
  attempt: UserAttempt,
  userContext: UserContext | undefined,
  isCorrect: boolean
): string {
  const parts: string[] = [];

  // Scenario context
  parts.push(`## Scenario: ${scenario.title}`);
  parts.push(`Symbol: ${scenario.symbol}`);
  parts.push(`Type: ${scenario.scenarioType}`);
  parts.push(`Difficulty: ${scenario.difficulty}`);
  parts.push(`Description: ${scenario.description}`);
  parts.push('');

  // Key levels
  parts.push('## Key Levels:');
  scenario.keyLevels.forEach(level => {
    parts.push(`- ${level.label}: $${level.price.toFixed(2)} (${level.type})`);
  });
  parts.push('');

  // LTP Analysis
  parts.push('## Correct LTP Analysis:');
  parts.push(`- Level Score: ${scenario.ltpAnalysis.level.score}/100 - ${scenario.ltpAnalysis.level.reason}`);
  parts.push(`- Trend Score: ${scenario.ltpAnalysis.trend.score}/100 - ${scenario.ltpAnalysis.trend.reason}`);
  parts.push(`- Patience Score: ${scenario.ltpAnalysis.patience.score}/100 - ${scenario.ltpAnalysis.patience.reason}`);
  parts.push('');

  // Correct answer and explanation
  parts.push(`## Correct Action: ${scenario.correctAction.toUpperCase()}`);
  parts.push(`Explanation: ${scenario.explanation}`);
  parts.push('');

  // User's attempt
  parts.push('## User\'s Attempt:');
  parts.push(`- Decision: ${attempt.decision.toUpperCase()}`);
  parts.push(`- Result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
  if (attempt.reasoning) {
    parts.push(`- User's Reasoning: "${attempt.reasoning}"`);
  }
  if (attempt.ltpChecklist) {
    parts.push('- User\'s LTP Assessment:');
    if (attempt.ltpChecklist.levelScore !== undefined) {
      parts.push(`  - Level: ${attempt.ltpChecklist.levelScore}/100`);
    }
    if (attempt.ltpChecklist.trendScore !== undefined) {
      parts.push(`  - Trend: ${attempt.ltpChecklist.trendScore}/100`);
    }
    if (attempt.ltpChecklist.patienceScore !== undefined) {
      parts.push(`  - Patience: ${attempt.ltpChecklist.patienceScore}/100`);
    }
    if (attempt.ltpChecklist.notes) {
      parts.push(`  - Notes: "${attempt.ltpChecklist.notes}"`);
    }
  }
  if (attempt.timeTakenSeconds) {
    parts.push(`- Time taken: ${attempt.timeTakenSeconds} seconds`);
  }
  if (attempt.emotionTag) {
    parts.push(`- Emotion: ${attempt.emotionTag}`);
  }
  parts.push('');

  // User context
  if (userContext) {
    parts.push('## User Context:');
    parts.push(`- Total practice attempts: ${userContext.totalAttempts}`);
    parts.push(`- Overall accuracy: ${userContext.accuracyPercent.toFixed(1)}%`);
    parts.push(`- Current streak: ${userContext.currentStreak} correct in a row`);
    if (userContext.weakAreas && userContext.weakAreas.length > 0) {
      parts.push(`- Areas needing work: ${userContext.weakAreas.join(', ')}`);
    }
    parts.push('');
  }

  // Focus area hint
  if (scenario.focusArea) {
    parts.push(`Focus area for this scenario: ${scenario.focusArea}`);
  }

  // Instructions
  parts.push('');
  parts.push('## Instructions:');
  parts.push('Provide coaching feedback in the following JSON format:');
  parts.push('```json');
  parts.push('{');
  parts.push('  "summary": "One sentence summary of the result",');
  parts.push('  "detailedFeedback": "2-3 sentences of detailed coaching feedback",');
  parts.push('  "ltpBreakdown": {');
  parts.push('    "level": "Feedback on level analysis",');
  parts.push('    "trend": "Feedback on trend analysis",');
  parts.push('    "patience": "Feedback on patience assessment"');
  parts.push('  },');
  parts.push('  "whatYouMissed": "Only if incorrect: what the user missed (null if correct)",');
  parts.push('  "encouragement": "Supportive message",');
  parts.push('  "richContent": "Optional [[LESSON:...]] markers for relevant lessons",');
  parts.push('  "nextSteps": ["Action item 1", "Action item 2"],');
  parts.push('  "personalizedTip": "Optional personalized tip based on user context"');
  parts.push('}');
  parts.push('```');

  return parts.join('\n');
}

/**
 * Parse the AI response into structured feedback
 */
function parseCoachingResponse(
  response: string,
  isCorrect: boolean,
  scenario: ScenarioData
): CoachingFeedback {
  try {
    // Extract JSON from the response
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                      response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    return {
      isCorrect,
      summary: parsed.summary || (isCorrect ? 'Correct!' : 'Not quite right.'),
      detailedFeedback: parsed.detailedFeedback || scenario.explanation,
      ltpBreakdown: {
        level: parsed.ltpBreakdown?.level || scenario.ltpAnalysis.level.reason,
        trend: parsed.ltpBreakdown?.trend || scenario.ltpAnalysis.trend.reason,
        patience: parsed.ltpBreakdown?.patience || scenario.ltpAnalysis.patience.reason,
      },
      whatYouMissed: isCorrect ? undefined : (parsed.whatYouMissed || undefined),
      encouragement: parsed.encouragement || (isCorrect ? 'Great job!' : 'Keep practicing!'),
      richContent: parsed.richContent || undefined,
      nextSteps: parsed.nextSteps || [],
      personalizedTip: parsed.personalizedTip || undefined,
    };
  } catch (error) {
    logger.warn('Failed to parse AI coaching response, using fallback', {
      error: error instanceof Error ? error.message : String(error),
    });

    return generateFallbackFeedback(
      scenario,
      { decision: isCorrect ? scenario.correctAction : 'wait' },
      isCorrect
    );
  }
}

/**
 * Generate fallback feedback when AI is unavailable
 */
function generateFallbackFeedback(
  scenario: ScenarioData,
  attempt: UserAttempt,
  isCorrect: boolean
): CoachingFeedback {
  const { ltpAnalysis } = scenario;

  if (isCorrect) {
    return {
      isCorrect: true,
      summary: `Correct! You identified this ${scenario.scenarioType} setup correctly.`,
      detailedFeedback: scenario.explanation,
      ltpBreakdown: {
        level: ltpAnalysis.level.reason,
        trend: ltpAnalysis.trend.reason,
        patience: ltpAnalysis.patience.reason,
      },
      encouragement: 'Excellent analysis! Your LTP framework application is solid.',
      nextSteps: [
        'Try a more challenging scenario',
        'Review similar setups to reinforce this pattern',
      ],
    };
  }

  // Incorrect response
  const userChose = attempt.decision;
  const correctChoice = scenario.correctAction;

  let whatMissed = '';
  if (userChose === 'long' && correctChoice === 'short') {
    whatMissed = 'The trend was actually bearish. Look for lower highs and VWAP position.';
  } else if (userChose === 'short' && correctChoice === 'long') {
    whatMissed = 'The trend was actually bullish. Check the higher lows and VWAP support.';
  } else if (userChose === 'long' && correctChoice === 'wait') {
    whatMissed = 'The setup needed more patience. Not enough confirmation at the level yet.';
  } else if (userChose === 'short' && correctChoice === 'wait') {
    whatMissed = 'Too early to short. The reversal needed more confirmation.';
  } else if (correctChoice === 'long') {
    whatMissed = 'This was a valid long setup with good LTP confluence.';
  } else if (correctChoice === 'short') {
    whatMissed = 'This was a valid short setup with good LTP confluence.';
  } else {
    whatMissed = 'The correct action was to wait for more confirmation.';
  }

  // Determine the weakest LTP component
  const scores = [
    { name: 'level', score: ltpAnalysis.level.score },
    { name: 'trend', score: ltpAnalysis.trend.score },
    { name: 'patience', score: ltpAnalysis.patience.score },
  ];

  // Find which area likely caused the mistake
  let focusArea = scenario.focusArea || 'patience';
  if (correctChoice === 'wait') {
    focusArea = 'patience';
  }

  const lessonSuggestion = scenario.relatedLessonSlug
    ? `[[LESSON:${scenario.relatedLessonSlug}|Review this concept|10 min]]`
    : `[[LESSON:ltp-framework/${focusArea}|${focusArea.charAt(0).toUpperCase() + focusArea.slice(1)} Analysis|15 min]]`;

  return {
    isCorrect: false,
    summary: `Not quite. The correct action was ${correctChoice.toUpperCase()}.`,
    detailedFeedback: scenario.explanation,
    ltpBreakdown: {
      level: ltpAnalysis.level.reason,
      trend: ltpAnalysis.trend.reason,
      patience: ltpAnalysis.patience.reason,
    },
    whatYouMissed: whatMissed,
    encouragement: 'Every mistake is a learning opportunity. Review the analysis and try again!',
    richContent: lessonSuggestion,
    nextSteps: [
      `Focus on ${focusArea} analysis`,
      'Re-read the LTP breakdown above',
      'Try a similar scenario',
    ],
  };
}

/**
 * Generate quick drill coaching (faster, simpler feedback for timed modes)
 */
export async function generateQuickDrillFeedback(
  scenario: ScenarioData,
  attempt: UserAttempt
): Promise<{ isCorrect: boolean; quickFeedback: string; tip: string }> {
  const isCorrect = attempt.decision === scenario.correctAction;

  if (isCorrect) {
    const tips = [
      'Strong level recognition!',
      'Good trend awareness.',
      'Patience paid off!',
      'Textbook LTP application.',
      'Clean analysis.',
    ];
    return {
      isCorrect: true,
      quickFeedback: 'Correct!',
      tip: tips[Math.floor(Math.random() * tips.length)],
    };
  }

  // Simple feedback for incorrect
  const { correctAction, ltpAnalysis } = scenario;

  let tip = '';
  if (correctAction === 'wait') {
    tip = `Patience score was only ${ltpAnalysis.patience.score}% - not enough confirmation.`;
  } else if (correctAction === 'long') {
    tip = `Level (${ltpAnalysis.level.score}%) + Trend (${ltpAnalysis.trend.score}%) supported a long.`;
  } else {
    tip = `Level (${ltpAnalysis.level.score}%) + Trend (${ltpAnalysis.trend.score}%) supported a short.`;
  }

  return {
    isCorrect: false,
    quickFeedback: `${correctAction.toUpperCase()} was correct.`,
    tip,
  };
}

/**
 * Generate adaptive scenario recommendation based on user performance
 */
export function getAdaptiveScenarioRecommendation(
  userContext: UserContext
): { focusArea: string; difficulty: string; scenarioTypes: string[] } {
  const { accuracyPercent, weakAreas, recentMistakes } = userContext;

  // Determine focus area
  let focusArea = 'level';
  if (weakAreas && weakAreas.length > 0) {
    focusArea = weakAreas[0];
  } else if (recentMistakes && recentMistakes.length > 0) {
    // Find most common mistake pattern
    const patterns: Record<string, number> = {};
    recentMistakes.forEach(m => {
      patterns[m.mistakePattern] = (patterns[m.mistakePattern] || 0) + 1;
    });
    const mostCommon = Object.entries(patterns).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon) {
      focusArea = mostCommon[0];
    }
  }

  // Determine difficulty
  let difficulty = 'beginner';
  if (accuracyPercent >= 80) {
    difficulty = 'advanced';
  } else if (accuracyPercent >= 60) {
    difficulty = 'intermediate';
  }

  // Suggest scenario types based on focus area
  const scenarioTypesMap: Record<string, string[]> = {
    level: ['level_test', 'support_bounce', 'resistance_rejection'],
    trend: ['trend_continuation', 'vwap_reclaim', 'trend_reversal'],
    patience: ['patience_test', 'wait_for_confirmation', 'psychology'],
  };

  return {
    focusArea,
    difficulty,
    scenarioTypes: scenarioTypesMap[focusArea] || ['level_test'],
  };
}
