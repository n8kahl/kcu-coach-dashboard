/**
 * Admin Content - Unified Video Library
 *
 * Serves both YouTube videos and Cloudflare uploads in a unified format
 * for the Content Studio Library Manager.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

interface LibraryVideo {
  id: string;
  type: 'youtube' | 'cloudflare';
  videoId: string;
  title: string;
  duration?: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  transcriptStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptText?: string;
  chunkCount?: number;
  topics?: string[];
  createdAt: string;
  url?: string;
  thumbnailUrl?: string;
  usedInLessons?: number;
}

/**
 * GET /api/admin/content/library
 *
 * Returns a unified list of all video assets:
 * - YouTube videos from youtube_videos table
 * - Cloudflare videos extracted from course_lessons
 *
 * Query params:
 * - type: 'youtube' | 'cloudflare' | 'all' (default: 'all')
 * - status: 'pending' | 'ready' | 'all' (default: 'all')
 * - search: string (search in titles)
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') || 'all';
    const statusFilter = searchParams.get('status') || 'all';
    const searchQuery = searchParams.get('search') || '';

    const videos: LibraryVideo[] = [];

    // Fetch YouTube videos - optimized to avoid N+1 queries
    if (typeFilter === 'all' || typeFilter === 'youtube') {
      const { data: youtubeVideos, error: ytError } = await supabaseAdmin
        .from('youtube_videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (ytError) {
        logger.error('Error fetching YouTube videos', { error: ytError.message });
      } else if (youtubeVideos && youtubeVideos.length > 0) {
        // Build all possible YouTube URLs for these videos
        const videoUrls = youtubeVideos.map(v => `https://www.youtube.com/watch?v=${v.video_id}`);

        // Single query to get lesson counts for all YouTube videos
        const { data: lessonCounts } = await supabaseAdmin
          .from('course_lessons')
          .select('video_url')
          .in('video_url', videoUrls);

        // Build a count map from the results
        const usageCountMap = new Map<string, number>();
        for (const lesson of lessonCounts || []) {
          if (lesson.video_url) {
            usageCountMap.set(lesson.video_url, (usageCountMap.get(lesson.video_url) || 0) + 1);
          }
        }

        for (const video of youtubeVideos) {
          const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;
          videos.push({
            id: video.id,
            type: 'youtube',
            videoId: video.video_id,
            title: video.title || `YouTube Video ${video.video_id}`,
            duration: video.duration_seconds,
            status: video.transcript_status === 'complete' ? 'ready' :
                   video.transcript_status === 'failed' ? 'failed' :
                   video.transcript_status === 'processing' ? 'processing' : 'pending',
            transcriptStatus: video.transcript_status as LibraryVideo['transcriptStatus'],
            chunkCount: video.chunk_count,
            topics: video.topics,
            createdAt: video.created_at,
            url: videoUrl,
            thumbnailUrl: `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`,
            usedInLessons: usageCountMap.get(videoUrl) || 0,
          });
        }
      }
    }

    // Fetch Cloudflare videos from course_lessons (unique video_uid values)
    if (typeFilter === 'all' || typeFilter === 'cloudflare') {
      const { data: lessons, error: cfError } = await supabaseAdmin
        .from('course_lessons')
        .select(`
          id,
          title,
          video_uid,
          video_duration_seconds,
          video_status,
          transcript_text,
          created_at,
          module:course_modules(
            title,
            course:courses(title)
          )
        `)
        .not('video_uid', 'is', null)
        .order('created_at', { ascending: false });

      if (cfError) {
        logger.error('Error fetching Cloudflare videos', { error: cfError.message });
      } else {
        // Group by video_uid to avoid duplicates
        const cfVideoMap = new Map<string, {
          lesson: typeof lessons[0];
          usageCount: number;
        }>();

        for (const lesson of lessons || []) {
          if (!lesson.video_uid) continue;

          const existing = cfVideoMap.get(lesson.video_uid);
          if (existing) {
            existing.usageCount++;
          } else {
            cfVideoMap.set(lesson.video_uid, {
              lesson,
              usageCount: 1,
            });
          }
        }

        for (const [videoUid, data] of Array.from(cfVideoMap.entries())) {
          const { lesson, usageCount } = data;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const moduleArr = lesson.module as Array<{ title: string; course: Array<{ title: string }> | null }> | null;
          const moduleData = moduleArr?.[0];

          // Create a descriptive title from the lesson context
          const contextTitle = moduleData?.course?.[0]?.title
            ? `${moduleData.course[0].title} - ${lesson.title}`
            : lesson.title;

          videos.push({
            id: `cf-${videoUid}`,
            type: 'cloudflare',
            videoId: videoUid,
            title: contextTitle,
            duration: lesson.video_duration_seconds || undefined,
            status: lesson.video_status === 'ready' ? 'ready' :
                   lesson.video_status === 'error' ? 'failed' :
                   lesson.video_status === 'processing' ? 'processing' : 'pending',
            transcriptStatus: lesson.transcript_text ? 'completed' : 'pending',
            transcriptText: lesson.transcript_text || undefined,
            createdAt: lesson.created_at,
            usedInLessons: usageCount,
          });
        }
      }
    }

    // Apply status filter
    let filteredVideos = videos;
    if (statusFilter !== 'all') {
      filteredVideos = videos.filter(v => {
        if (statusFilter === 'pending') return v.status === 'pending' || v.status === 'processing';
        if (statusFilter === 'ready') return v.status === 'ready';
        return true;
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredVideos = filteredVideos.filter(v =>
        v.title.toLowerCase().includes(query) ||
        v.videoId.toLowerCase().includes(query) ||
        v.topics?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Sort by created date (newest first)
    filteredVideos.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      videos: filteredVideos,
      stats: {
        total: videos.length,
        youtube: videos.filter(v => v.type === 'youtube').length,
        cloudflare: videos.filter(v => v.type === 'cloudflare').length,
        ready: videos.filter(v => v.status === 'ready').length,
        pending: videos.filter(v => v.status === 'pending' || v.status === 'processing').length,
      },
    });
  } catch (error) {
    logger.error(
      'Error in library GET',
      error instanceof Error ? error : { message: String(error) }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
