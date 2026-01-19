/**
 * Admin Content API - Single Lesson Operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/content/lessons/[id]
 * Get a single lesson
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: lesson, error } = await supabaseAdmin
      .from('course_lessons')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        moduleId: lesson.module_id,
        title: lesson.title,
        slug: lesson.slug,
        description: lesson.description,
        lessonNumber: lesson.lesson_number,
        videoUrl: lesson.video_url,
        videoUid: lesson.video_uid,
        videoDurationSeconds: lesson.video_duration_seconds,
        videoStatus: lesson.video_status,
        videoPlaybackHls: lesson.video_playback_hls,
        videoPlaybackDash: lesson.video_playback_dash,
        thumbnailUrl: lesson.thumbnail_url,
        transcriptUrl: lesson.transcript_url,
        transcriptText: lesson.transcript_text,
        resources: lesson.resources || [],
        requireSignedUrls: lesson.require_signed_urls,
        sortOrder: lesson.sort_order,
        isPreview: lesson.is_preview,
        isPublished: lesson.is_published,
        isRequired: lesson.is_required,
        minWatchPercent: lesson.min_watch_percent,
        allowSkip: lesson.allow_skip,
        createdAt: lesson.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching lesson:', error);
    return NextResponse.json({ error: 'Failed to fetch lesson' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/content/lessons/[id]
 * Update a lesson
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      slug,
      description,
      lessonNumber,
      videoUrl,
      videoUid,
      videoDurationSeconds,
      videoStatus,
      videoPlaybackHls,
      videoPlaybackDash,
      thumbnailUrl,
      transcriptUrl,
      transcriptText,
      resources,
      requireSignedUrls,
      isPreview,
      isPublished,
      isRequired,
      minWatchPercent,
      allowSkip,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (lessonNumber !== undefined) updateData.lesson_number = lessonNumber;
    if (videoUrl !== undefined) updateData.video_url = videoUrl;
    if (videoUid !== undefined) updateData.video_uid = videoUid;
    if (videoDurationSeconds !== undefined) updateData.video_duration_seconds = videoDurationSeconds;
    if (videoStatus !== undefined) updateData.video_status = videoStatus;
    if (videoPlaybackHls !== undefined) updateData.video_playback_hls = videoPlaybackHls;
    if (videoPlaybackDash !== undefined) updateData.video_playback_dash = videoPlaybackDash;
    if (thumbnailUrl !== undefined) updateData.thumbnail_url = thumbnailUrl;
    if (transcriptUrl !== undefined) updateData.transcript_url = transcriptUrl;
    if (transcriptText !== undefined) updateData.transcript_text = transcriptText;
    if (resources !== undefined) updateData.resources = resources;
    if (requireSignedUrls !== undefined) updateData.require_signed_urls = requireSignedUrls;
    if (isPreview !== undefined) updateData.is_preview = isPreview;
    if (isPublished !== undefined) updateData.is_published = isPublished;
    if (isRequired !== undefined) updateData.is_required = isRequired;
    if (minWatchPercent !== undefined) updateData.min_watch_percent = minWatchPercent;
    if (allowSkip !== undefined) updateData.allow_skip = allowSkip;

    const { data: lesson, error } = await supabaseAdmin
      .from('course_lessons')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        moduleId: lesson.module_id,
        title: lesson.title,
        slug: lesson.slug,
        description: lesson.description,
        lessonNumber: lesson.lesson_number,
        videoUrl: lesson.video_url,
        videoUid: lesson.video_uid,
        videoDurationSeconds: lesson.video_duration_seconds,
        videoStatus: lesson.video_status,
        videoPlaybackHls: lesson.video_playback_hls,
        videoPlaybackDash: lesson.video_playback_dash,
        thumbnailUrl: lesson.thumbnail_url,
        transcriptUrl: lesson.transcript_url,
        transcriptText: lesson.transcript_text,
        resources: lesson.resources || [],
        requireSignedUrls: lesson.require_signed_urls,
        sortOrder: lesson.sort_order,
        isPreview: lesson.is_preview,
        isPublished: lesson.is_published,
        isRequired: lesson.is_required,
        minWatchPercent: lesson.min_watch_percent,
        allowSkip: lesson.allow_skip,
      },
    });
  } catch (error) {
    console.error('Error updating lesson:', error);
    return NextResponse.json({ error: 'Failed to update lesson' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/content/lessons/[id]
 * Delete a lesson
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabaseAdmin
      .from('course_lessons')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    return NextResponse.json({ error: 'Failed to delete lesson' }, { status: 500 });
  }
}
