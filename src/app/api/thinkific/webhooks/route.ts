/**
 * Thinkific Webhooks API Route
 *
 * Handles webhook events from Thinkific for:
 * - User enrollment
 * - Lesson completion
 * - Course completion
 * - Progress updates
 *
 * Webhook Documentation: https://developers.thinkific.com/api/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import crypto from 'crypto';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Types
// ============================================

interface ThinkificWebhookPayload {
  resource: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface ThinkificUserPayload {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  external_id?: string;
  created_at: string;
}

interface ThinkificEnrollmentPayload {
  id: number;
  user_id: number;
  user_email: string;
  course_id: number;
  course_name: string;
  percentage_completed: number;
  completed: boolean;
  started_at: string;
  completed_at?: string;
  activated_at: string;
  expired: boolean;
  expiry_date?: string;
}

interface ThinkificLessonCompletePayload {
  user_id: number;
  user_email: string;
  course_id: number;
  course_name: string;
  chapter_id: number;
  chapter_name: string;
  content_id: number;
  content_name: string;
  content_type: string;
  completed_at: string;
}

interface ThinkificCourseCompletePayload {
  id: number;
  user_id: number;
  user_email: string;
  course_id: number;
  course_name: string;
  percentage_completed: number;
  completed: boolean;
  completed_at: string;
}

// ============================================
// Webhook Verification
// ============================================

/**
 * Verify Thinkific webhook signature
 * Thinkific signs webhooks with HMAC-SHA256 using your API key
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ============================================
// Event Handlers
// ============================================

/**
 * Handle user.created webhook
 */
async function handleUserCreated(payload: ThinkificUserPayload) {
  console.log('Thinkific user.created:', payload.email);

  // If external_id is set, link to existing KCU user
  if (payload.external_id) {
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        thinkific_user_id: payload.id,
        thinkific_email: payload.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.external_id);

    if (error) {
      console.error('Failed to link Thinkific user:', error);
    }
  }

  // Store in thinkific_users table for reference
  await supabaseAdmin.from('thinkific_users').upsert({
    thinkific_id: payload.id,
    email: payload.email,
    first_name: payload.first_name,
    last_name: payload.last_name,
    external_id: payload.external_id,
    created_at: payload.created_at,
    synced_at: new Date().toISOString(),
  }, { onConflict: 'thinkific_id' });
}

/**
 * Handle enrollment.created webhook
 */
async function handleEnrollmentCreated(payload: ThinkificEnrollmentPayload) {
  console.log('Thinkific enrollment.created:', payload.user_email, payload.course_name);

  // Store enrollment
  await supabaseAdmin.from('thinkific_enrollments').upsert({
    thinkific_enrollment_id: payload.id,
    thinkific_user_id: payload.user_id,
    user_email: payload.user_email,
    course_id: payload.course_id,
    course_name: payload.course_name,
    percentage_completed: payload.percentage_completed,
    completed: payload.completed,
    started_at: payload.started_at,
    completed_at: payload.completed_at,
    activated_at: payload.activated_at,
    expired: payload.expired,
    expiry_date: payload.expiry_date,
    synced_at: new Date().toISOString(),
  }, { onConflict: 'thinkific_enrollment_id' });

  // Update KCU user progress if we can match them
  const { data: kcuUser } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('thinkific_user_id', payload.user_id)
    .single();

  if (kcuUser) {
    // Award XP for enrollment
    await supabaseAdmin.rpc('add_user_xp', {
      p_user_id: kcuUser.id,
      p_xp: 50,
      p_source: 'thinkific_enrollment',
      p_source_id: payload.id.toString(),
    });
  }
}

/**
 * Handle enrollment.progress webhook
 */
async function handleEnrollmentProgress(payload: ThinkificEnrollmentPayload) {
  console.log('Thinkific enrollment.progress:', payload.user_email, payload.percentage_completed);

  // Update enrollment progress
  await supabaseAdmin.from('thinkific_enrollments').upsert({
    thinkific_enrollment_id: payload.id,
    thinkific_user_id: payload.user_id,
    user_email: payload.user_email,
    course_id: payload.course_id,
    course_name: payload.course_name,
    percentage_completed: payload.percentage_completed,
    completed: payload.completed,
    completed_at: payload.completed_at,
    synced_at: new Date().toISOString(),
  }, { onConflict: 'thinkific_enrollment_id' });
}

/**
 * Handle lesson.completed webhook
 */
async function handleLessonCompleted(payload: ThinkificLessonCompletePayload) {
  console.log('Thinkific lesson.completed:', payload.user_email, payload.content_name);

  // Store lesson completion
  await supabaseAdmin.from('thinkific_lesson_completions').insert({
    thinkific_user_id: payload.user_id,
    user_email: payload.user_email,
    course_id: payload.course_id,
    course_name: payload.course_name,
    chapter_id: payload.chapter_id,
    chapter_name: payload.chapter_name,
    content_id: payload.content_id,
    content_name: payload.content_name,
    content_type: payload.content_type,
    completed_at: payload.completed_at,
    synced_at: new Date().toISOString(),
  });

  // Update KCU user progress if we can match them
  const { data: kcuUser } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('thinkific_user_id', payload.user_id)
    .single();

  if (kcuUser) {
    // Award XP for lesson completion
    const xpAmount = payload.content_type === 'quiz' ? 100 : 25;
    await supabaseAdmin.rpc('add_user_xp', {
      p_user_id: kcuUser.id,
      p_xp: xpAmount,
      p_source: `thinkific_lesson_${payload.content_type}`,
      p_source_id: payload.content_id.toString(),
    });

    // Check for achievements
    await checkLessonAchievements(kcuUser.id, payload);
  }
}

/**
 * Handle course.completed webhook
 */
async function handleCourseCompleted(payload: ThinkificCourseCompletePayload) {
  console.log('Thinkific course.completed:', payload.user_email, payload.course_name);

  // Update enrollment as completed
  await supabaseAdmin.from('thinkific_enrollments').update({
    completed: true,
    percentage_completed: 100,
    completed_at: payload.completed_at,
    synced_at: new Date().toISOString(),
  }).eq('thinkific_enrollment_id', payload.id);

  // Update KCU user progress if we can match them
  const { data: kcuUser } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('thinkific_user_id', payload.user_id)
    .single();

  if (kcuUser) {
    // Award XP for course completion
    await supabaseAdmin.rpc('add_user_xp', {
      p_user_id: kcuUser.id,
      p_xp: 500,
      p_source: 'thinkific_course_complete',
      p_source_id: payload.course_id.toString(),
    });

    // Unlock course completion achievement
    await supabaseAdmin.from('user_achievements').upsert({
      user_id: kcuUser.id,
      achievement_id: `course_complete_${payload.course_id}`,
      earned_at: payload.completed_at,
    }, { onConflict: 'user_id,achievement_id' });
  }
}

/**
 * Check and award lesson-based achievements
 */
async function checkLessonAchievements(userId: string, lesson: ThinkificLessonCompletePayload) {
  // Get total lesson completions
  const { count } = await supabaseAdmin
    .from('thinkific_lesson_completions')
    .select('*', { count: 'exact', head: true })
    .eq('thinkific_user_id', lesson.user_id);

  // Achievement milestones
  const milestones = [
    { count: 1, achievement: 'first_lesson' },
    { count: 10, achievement: 'ten_lessons' },
    { count: 25, achievement: 'twenty_five_lessons' },
    { count: 50, achievement: 'fifty_lessons' },
    { count: 100, achievement: 'hundred_lessons' },
  ];

  for (const milestone of milestones) {
    if (count && count >= milestone.count) {
      await supabaseAdmin.from('user_achievements').upsert({
        user_id: userId,
        achievement_id: milestone.achievement,
        earned_at: new Date().toISOString(),
      }, { onConflict: 'user_id,achievement_id' });
    }
  }
}

// ============================================
// Main Webhook Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const signature = headersList.get('x-thinkific-hmac-sha256');
    const rawBody = await request.text();

    // Verify webhook signature if API key is configured
    const apiKey = process.env.THINKIFIC_API_KEY;
    if (apiKey && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, apiKey);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const webhook: ThinkificWebhookPayload = JSON.parse(rawBody);
    const { resource, action, payload } = webhook;

    console.log(`Thinkific webhook: ${resource}.${action}`);

    // Route to appropriate handler
    const eventType = `${resource}.${action}`;
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(payload as unknown as ThinkificUserPayload);
        break;

      case 'enrollment.created':
        await handleEnrollmentCreated(payload as unknown as ThinkificEnrollmentPayload);
        break;

      case 'enrollment.progress':
        await handleEnrollmentProgress(payload as unknown as ThinkificEnrollmentPayload);
        break;

      case 'lesson.completed':
        await handleLessonCompleted(payload as unknown as ThinkificLessonCompletePayload);
        break;

      case 'course.completed':
        await handleCourseCompleted(payload as unknown as ThinkificCourseCompletePayload);
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    // Log webhook for debugging
    await supabaseAdmin.from('thinkific_webhook_logs').insert({
      event_type: eventType,
      payload: webhook,
      received_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Thinkific sends GET requests to verify webhook URL
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'thinkific-webhooks' });
}
