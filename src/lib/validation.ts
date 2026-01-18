import { z } from 'zod';

// ============================================
// Common Schemas
// ============================================

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const symbolSchema = z.string()
  .min(1)
  .max(10)
  .regex(/^[A-Z]{1,5}$/, 'Symbol must be 1-5 uppercase letters');

// ============================================
// Trade Schemas
// ============================================

export const tradeDirectionSchema = z.enum(['long', 'short']);

export const tradeStatusSchema = z.enum(['open', 'closed']);

export const contractTypeSchema = z.enum(['stock', 'call', 'put']);

export const emotionSchema = z.enum([
  'calm',
  'confident',
  'anxious',
  'fearful',
  'greedy',
  'frustrated',
  'excited',
  'neutral',
]);

export const createTradeSchema = z.object({
  symbol: symbolSchema,
  direction: tradeDirectionSchema,
  entry_price: z.number().positive(),
  exit_price: z.number().positive().optional(),
  quantity: z.number().positive(),
  contract_type: contractTypeSchema.optional(),
  strike_price: z.number().positive().optional(),
  expiration_date: z.string().optional(),
  entry_time: z.string().datetime(),
  exit_time: z.string().datetime().optional(),
  setup_type: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  emotions: z.array(emotionSchema).optional(),
  mistakes: z.array(z.string().max(200)).optional(),
  lessons: z.string().max(2000).optional(),
  screenshots: z.array(z.string().url()).max(5).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  had_level: z.boolean().optional(),
  had_trend: z.boolean().optional(),
  had_patience: z.boolean().optional(),
  followed_plan: z.boolean().optional(),
});

export const updateTradeSchema = createTradeSchema.partial();

export const tradeQuerySchema = z.object({
  symbol: z.string().optional(),
  direction: tradeDirectionSchema.optional(),
  status: tradeStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// ============================================
// Learning Schemas
// ============================================

export const lessonProgressSchema = z.object({
  lesson_id: z.string().uuid(),
  completed: z.boolean().optional(),
  watch_time: z.number().min(0).optional(),
});

export const quizAnswerSchema = z.object({
  question_id: z.string(),
  selected_option_id: z.string(),
});

export const quizSubmissionSchema = z.object({
  quiz_id: z.string(),
  answers: z.array(quizAnswerSchema).min(1),
  time_taken: z.number().min(0).optional(),
});

// ============================================
// Alert Schemas
// ============================================

export const alertTypeSchema = z.enum([
  'loading',
  'entering',
  'adding',
  'take_profit',
  'exiting',
  'stopped_out',
  'update',
]);

export const createAlertSchema = z.object({
  symbol: symbolSchema,
  direction: tradeDirectionSchema,
  alert_type: alertTypeSchema,
  contract: z.string().max(50).optional(),
  entry_price: z.number().positive().optional(),
  stop_loss: z.number().positive().optional(),
  targets: z.array(z.number().positive()).max(5).optional(),
  message: z.string().min(1).max(1000),
  ltp_justification: z.string().max(500).optional(),
});

export const updateAlertSchema = createAlertSchema.partial().extend({
  is_active: z.boolean().optional(),
});

// ============================================
// User Schemas
// ============================================

export const updateUserSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  trading_style: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  notification_preferences: z.object({
    email_alerts: z.boolean().optional(),
    push_alerts: z.boolean().optional(),
    sound_enabled: z.boolean().optional(),
  }).optional(),
});

// ============================================
// Companion Mode Schemas
// ============================================

export const watchlistSchema = z.object({
  name: z.string().min(1).max(50),
  symbols: z.array(symbolSchema).min(1).max(50),
  is_shared: z.boolean().default(false),
});

export const setupSubscriptionSchema = z.object({
  symbol: symbolSchema,
  min_confluence: z.number().min(0).max(100).default(70),
  notify_on_forming: z.boolean().default(true),
  notify_on_ready: z.boolean().default(true),
  notify_on_triggered: z.boolean().default(true),
});

// ============================================
// Market Data Schemas
// ============================================

export const quoteRequestSchema = z.object({
  symbol: symbolSchema,
});

export const barsRequestSchema = z.object({
  symbol: symbolSchema,
  timeframe: z.enum(['1m', '2m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']),
  limit: z.coerce.number().min(1).max(1000).default(100),
});

// ============================================
// Chat Schemas
// ============================================

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  context: z.object({
    symbol: z.string().optional(),
    trade_id: z.string().optional(),
  }).optional(),
});

// ============================================
// Validation Utilities
// ============================================

/**
 * Parse and validate request body
 * Throws ZodError if validation fails
 */
export async function validateBody<T extends z.ZodSchema>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  const body = await request.json();
  return schema.parse(body);
}

/**
 * Parse and validate URL search params
 */
export function validateQuery<T extends z.ZodSchema>(
  url: URL | string,
  schema: T
): z.infer<T> {
  const urlObj = typeof url === 'string' ? new URL(url) : url;
  const params = Object.fromEntries(urlObj.searchParams.entries());
  return schema.parse(params);
}

/**
 * Safe parse that returns result object instead of throwing
 */
export function safeParse<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

// Re-export z for convenience
export { z };
