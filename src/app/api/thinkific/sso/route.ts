/**
 * Thinkific SSO API Route
 *
 * Generates SSO URLs for deep-linking users to Thinkific courses/lessons.
 * Requires authenticated user session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  generateSSOUrl,
  generateLessonSSOUrl,
  generateCourseSSOUrl,
  generateDashboardSSOUrl,
  generateVideoTimestampLink,
  isSSoConfigured,
  type ThinkificUser,
} from '@/lib/thinkific-sso';

// ============================================
// Types
// ============================================

interface SSORequest {
  type: 'course' | 'lesson' | 'dashboard' | 'custom';
  courseSlug?: string;
  lessonSlug?: string;
  timestampSeconds?: number;
  returnTo?: string;
}

// ============================================
// POST /api/thinkific/sso
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Check if SSO is configured
    if (!isSSoConfigured()) {
      return NextResponse.json(
        { error: 'Thinkific SSO is not configured' },
        { status: 503 }
      );
    }

    // Get authenticated user
    const session = await getSession();

    if (!session.user || !session.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user profile for Thinkific
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('discord_username, email')
      .eq('id', session.userId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body: SSORequest = await request.json();

    // Build Thinkific user object
    const thinkificUser: ThinkificUser = {
      email: profile.email || session.user.email || '',
      firstName: session.user.username || 'User',
      lastName: '',
      externalId: session.userId,
    };

    let ssoUrl: string;

    switch (body.type) {
      case 'course':
        if (!body.courseSlug) {
          return NextResponse.json(
            { error: 'courseSlug is required for course type' },
            { status: 400 }
          );
        }
        ssoUrl = await generateCourseSSOUrl(thinkificUser, body.courseSlug);
        break;

      case 'lesson':
        if (!body.courseSlug || !body.lessonSlug) {
          return NextResponse.json(
            { error: 'courseSlug and lessonSlug are required for lesson type' },
            { status: 400 }
          );
        }
        ssoUrl = await generateLessonSSOUrl(
          thinkificUser,
          { courseSlug: body.courseSlug, lessonSlug: body.lessonSlug },
          body.timestampSeconds
        );
        break;

      case 'dashboard':
        ssoUrl = await generateDashboardSSOUrl(thinkificUser);
        break;

      case 'custom':
        if (!body.returnTo) {
          return NextResponse.json(
            { error: 'returnTo is required for custom type' },
            { status: 400 }
          );
        }
        ssoUrl = await generateSSOUrl(thinkificUser, {
          returnTo: body.returnTo,
          timestampSeconds: body.timestampSeconds,
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be: course, lesson, dashboard, or custom' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      ssoUrl,
      expiresIn: 300, // JWT expires in 5 minutes
    });

  } catch (error) {
    console.error('Thinkific SSO error:', error);
    return NextResponse.json(
      { error: 'Failed to generate SSO URL' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/thinkific/sso/video-link
// Generate a video timestamp link for AI coach responses
// ============================================

export async function GET(request: NextRequest) {
  try {
    if (!isSSoConfigured()) {
      return NextResponse.json(
        { error: 'Thinkific SSO is not configured' },
        { status: 503 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const courseSlug = searchParams.get('course');
    const lessonSlug = searchParams.get('lesson');
    const startSeconds = searchParams.get('start');
    const endSeconds = searchParams.get('end');

    if (!courseSlug || !lessonSlug || !startSeconds) {
      return NextResponse.json(
        { error: 'course, lesson, and start parameters are required' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const session = await getSession();

    if (!session.user || !session.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('discord_username, email')
      .eq('id', session.userId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const thinkificUser: ThinkificUser = {
      email: profile.email || session.user.email || '',
      firstName: session.user.username || 'User',
      lastName: '',
      externalId: session.userId,
    };

    const link = await generateVideoTimestampLink(
      thinkificUser,
      courseSlug,
      lessonSlug,
      parseInt(startSeconds, 10),
      endSeconds ? parseInt(endSeconds, 10) : undefined
    );

    return NextResponse.json({
      success: true,
      ...link,
    });

  } catch (error) {
    console.error('Video link generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate video link' },
      { status: 500 }
    );
  }
}
