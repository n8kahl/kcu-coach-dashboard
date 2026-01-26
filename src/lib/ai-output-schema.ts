/**
 * AI Output Schema
 *
 * Strict Zod validation for AI coaching responses.
 * Ensures all AI output is structured, validated, and safe.
 *
 * CRITICAL: The AI must NEVER compute LTP scores - it only explains
 * pre-computed ScoreExplanation objects from the LTP engines.
 */

import { z } from 'zod';
import logger from './logger';

/**
 * Typed action types the AI can suggest
 */
export const CoachActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('view_lesson'),
    lessonSlug: z.string().min(1),
    title: z.string().min(1),
  }),
  z.object({
    type: z.literal('review_trade'),
    tradeId: z.string().min(1),
  }),
  z.object({
    type: z.literal('practice_scenario'),
    scenarioId: z.string().min(1),
  }),
  z.object({
    type: z.literal('view_chart'),
    symbol: z.string().min(1).max(10),
    timeframe: z.string().optional(),
  }),
  z.object({
    type: z.literal('wait'),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal('ask_question'),
    question: z.string().min(1),
  }),
]);

export type CoachAction = z.infer<typeof CoachActionSchema>;

/**
 * Reference to inputs used in generating the response
 */
export const ReferenceSchema = z.object({
  type: z.enum([
    'score_explanation',
    'trade_data',
    'lesson_content',
    'market_data',
    'user_history',
    'conversation_context',
  ]),
  id: z.string().optional(),
  summary: z.string().min(1).max(200),
});

export type Reference = z.infer<typeof ReferenceSchema>;

/**
 * Main CoachResponse schema - all AI responses must conform to this
 */
export const CoachResponseSchema = z.object({
  message: z.string().min(1).max(4000),
  confidence: z.enum(['low', 'medium', 'high']),
  actions: z.array(CoachActionSchema).max(3).default([]),
  disclaimers: z.array(z.string().max(200)).max(5).default([]),
  references: z.array(ReferenceSchema).max(10).default([]),
});

export type CoachResponse = z.infer<typeof CoachResponseSchema>;

/**
 * Safe fallback response when AI output fails validation.
 * This ensures users always get a valid response, never an error.
 */
export const SAFE_FALLBACK_RESPONSE: CoachResponse = {
  message:
    "I'm having trouble formulating a response right now. The LTP scores shown are calculated by our deterministic engine and are accurate. Please review the score breakdown, or try rephrasing your question.",
  confidence: 'low',
  actions: [],
  disclaimers: [
    'This is a fallback response due to a processing issue.',
    'All LTP scores displayed are calculated by our engine and remain accurate.',
  ],
  references: [],
};

/**
 * Parse and validate AI response JSON.
 * Returns a validated CoachResponse or the safe fallback.
 *
 * @param rawResponse - Raw string from AI (should be JSON)
 * @param context - Optional context for logging
 * @returns Validated CoachResponse
 */
export function parseAICoachResponse(
  rawResponse: string,
  context?: { userId?: string; messageId?: string }
): CoachResponse {
  // Try to extract JSON from the response (AI might include markdown code blocks)
  let jsonString = rawResponse.trim();

  // Handle markdown code blocks
  const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1].trim();
  }

  // Try to parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (parseError) {
    logger.warn('AI response JSON parse failed', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      rawResponse: rawResponse.slice(0, 500),
      ...context,
    });
    return SAFE_FALLBACK_RESPONSE;
  }

  // Validate against schema
  const result = CoachResponseSchema.safeParse(parsed);

  if (!result.success) {
    logger.warn('AI response validation failed', {
      errors: result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
      rawResponse: rawResponse.slice(0, 500),
      ...context,
    });
    return SAFE_FALLBACK_RESPONSE;
  }

  return result.data;
}

/**
 * System prompt addition for structured output.
 * This instructs the AI to return valid JSON and never compute scores.
 */
export const STRUCTURED_OUTPUT_PROMPT = `
=== CRITICAL: SCORE COMPUTATION RULES ===

You MUST NOT compute, calculate, or estimate LTP scores. All scores are computed by our deterministic LTP engine and provided to you in the ScoreExplanation object below.

Your role is to:
1. EXPLAIN what the pre-computed scores mean in plain language
2. COACH the user on how to improve their trading
3. SUGGEST next steps based on the scores and their question

You MUST NOT:
- Invent or modify scores
- Claim different scores than provided in ScoreExplanation
- Compute new scores from market data or user descriptions
- Override or "correct" the engine's calculations

If asked to compute scores, respond: "Scores are calculated by our LTP engine to ensure consistency. Let me explain what your current scores mean."

=== OUTPUT FORMAT (MANDATORY) ===

You MUST respond with ONLY valid JSON matching this exact schema. No markdown, no explanation outside the JSON:

{
  "message": "Your coaching message here (max 4000 chars)",
  "confidence": "low" | "medium" | "high",
  "actions": [
    { "type": "view_lesson", "lessonSlug": "slug", "title": "Title" },
    { "type": "review_trade", "tradeId": "id" },
    { "type": "practice_scenario", "scenarioId": "id" },
    { "type": "view_chart", "symbol": "SPY", "timeframe": "5m" },
    { "type": "wait", "reason": "Why to wait" },
    { "type": "ask_question", "question": "Follow-up question" }
  ],
  "disclaimers": ["Any important caveats"],
  "references": [
    { "type": "score_explanation", "summary": "LTP score breakdown used" },
    { "type": "trade_data", "id": "trade-123", "summary": "Recent AAPL trade" }
  ]
}

Rules:
- "message" is required, 1-4000 characters
- "confidence" is required: "low" (uncertain), "medium" (reasonably sure), "high" (very confident)
- "actions" max 3 items, suggest specific next steps
- "disclaimers" max 5 items, important caveats for the user
- "references" list what inputs you used (MUST include score_explanation if scores were discussed)
`;

/**
 * Format a ScoreExplanation for inclusion in the AI prompt
 */
export function formatScoreExplanationForPrompt(
  explanation: {
    scores?: { level: number; trend: number; patience: number; overall: number };
    grade?: string;
    reasons?: { level: string; trend: string; patience: string };
    score?: number;
    breakdown?: Record<string, { score: number; reason: string }>;
    recommendation?: string;
    warnings?: string[];
    inputs?: Record<string, unknown>;
  } | null
): string {
  if (!explanation) {
    return `
=== SCORE EXPLANATION ===
No score explanation available for this request.
If the user asks about scores, explain that you need trade data or market context to provide score analysis.
`;
  }

  // Handle LTP 1.0 format
  if (explanation.scores && explanation.reasons) {
    return `
=== SCORE EXPLANATION (LTP 1.0) ===
These scores are pre-computed by our deterministic engine. DO NOT modify them.

Overall Grade: ${explanation.grade}
Overall Score: ${explanation.scores.overall}/100

Component Breakdown:
- Level Score: ${explanation.scores.level}/100
  Reason: ${explanation.reasons.level}

- Trend Score: ${explanation.scores.trend}/100
  Reason: ${explanation.reasons.trend}

- Patience Score: ${explanation.scores.patience}/100
  Reason: ${explanation.reasons.patience}

Input Data Used:
${JSON.stringify(explanation.inputs, null, 2)}
`;
  }

  // Handle LTP 2.0 Gamma format
  if (explanation.breakdown) {
    const breakdownText = Object.entries(explanation.breakdown)
      .map(([key, val]) => `- ${key}: ${val.score} pts\n  Reason: ${val.reason}`)
      .join('\n\n');

    return `
=== SCORE EXPLANATION (LTP 2.0 Gamma) ===
These scores are pre-computed by our deterministic engine. DO NOT modify them.

Overall Score: ${explanation.score}/90
Grade: ${explanation.grade}
Recommendation: ${explanation.recommendation}

Component Breakdown:
${breakdownText}

Warnings: ${explanation.warnings?.join(', ') || 'None'}

Input Data Used:
${JSON.stringify(explanation.inputs, null, 2)}
`;
  }

  return `
=== SCORE EXPLANATION ===
Score data provided: ${JSON.stringify(explanation, null, 2)}
`;
}
