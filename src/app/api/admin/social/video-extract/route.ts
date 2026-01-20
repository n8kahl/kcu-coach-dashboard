// ============================================
// Video Content Extraction API Route
// Analyzes video transcripts and generates
// social media clip content
// ============================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, internalError, badRequest } from '@/lib/api-errors';
import { z } from 'zod';
import {
  extractVideoContent,
  quickAnalyzeTranscript,
  extractHighValueMoments,
  VideoAnalysisResult,
} from '@/lib/social/video-content-extractor';
import { transcribeCloudflareVideo, transcribeAudioFromUrl } from '@/lib/transcription';

// ============================================
// Request Validation
// ============================================

const ExtractFromTranscriptSchema = z.object({
  transcript: z.string().min(100, 'Transcript must be at least 100 characters'),
  videoId: z.string().optional(),
  estimatedDuration: z.number().optional(),
  generateClips: z.boolean().optional().default(true),
  maxMoments: z.number().min(1).max(20).optional().default(10),
});

const ExtractFromVideoSchema = z.object({
  videoUid: z.string().min(1, 'Video UID is required'),
  videoId: z.string().optional(),
  generateClips: z.boolean().optional().default(true),
  maxMoments: z.number().min(1).max(20).optional().default(10),
});

const ExtractFromUrlSchema = z.object({
  videoUrl: z.string().url('Valid URL is required'),
  videoId: z.string().optional(),
  generateClips: z.boolean().optional().default(true),
  maxMoments: z.number().min(1).max(20).optional().default(10),
});

const QuickAnalyzeSchema = z.object({
  transcript: z.string().min(50, 'Transcript must be at least 50 characters'),
});

// ============================================
// POST - Full extraction from transcript
// ============================================

export const POST = withErrorHandler(async (request: Request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'extract';

  const body = await request.json();

  // Quick analysis (no clip generation)
  if (action === 'quick-analyze') {
    const { transcript } = QuickAnalyzeSchema.parse(body);

    const result = quickAnalyzeTranscript(transcript);

    return NextResponse.json({
      success: true,
      data: result,
    });
  }

  // Extract from Cloudflare video UID
  if (action === 'from-video') {
    const { videoUid, videoId, generateClips, maxMoments } = ExtractFromVideoSchema.parse(body);

    // Step 1: Transcribe the video
    const transcriptResult = await transcribeCloudflareVideo(videoUid);

    if (!transcriptResult.success || !transcriptResult.transcript) {
      return badRequest(transcriptResult.error || 'Failed to transcribe video');
    }

    // Step 2: Extract content
    const result = await extractVideoContent(transcriptResult.transcript, {
      videoId: videoId || videoUid,
      estimatedDuration: transcriptResult.duration,
      generateClips,
      maxMoments,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        transcriptLength: transcriptResult.transcript.length,
        transcriptDuration: transcriptResult.duration,
      },
    });
  }

  // Extract from video URL
  if (action === 'from-url') {
    const { videoUrl, videoId, generateClips, maxMoments } = ExtractFromUrlSchema.parse(body);

    // Step 1: Transcribe from URL
    const transcriptResult = await transcribeAudioFromUrl(videoUrl);

    if (!transcriptResult.success || !transcriptResult.transcript) {
      return badRequest(transcriptResult.error || 'Failed to transcribe video');
    }

    // Step 2: Extract content
    const result = await extractVideoContent(transcriptResult.transcript, {
      videoId: videoId || 'url-video',
      estimatedDuration: transcriptResult.duration,
      generateClips,
      maxMoments,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        transcriptLength: transcriptResult.transcript.length,
        transcriptDuration: transcriptResult.duration,
      },
    });
  }

  // Default: Extract from provided transcript
  const { transcript, videoId, estimatedDuration, generateClips, maxMoments } =
    ExtractFromTranscriptSchema.parse(body);

  try {
    const result: VideoAnalysisResult = await extractVideoContent(transcript, {
      videoId,
      estimatedDuration,
      generateClips,
      maxMoments,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Video extraction error:', error);

    const message = error instanceof Error
      ? `Extraction failed: ${error.message}`
      : 'Failed to extract video content';

    return internalError(message);
  }
});

// ============================================
// GET - Return extraction feature info
// ============================================

export const GET = withErrorHandler(async () => {
  await requireAdmin();

  return NextResponse.json({
    success: true,
    feature: 'video-extract',
    description: 'Extract high-value moments and generate social media clips from video transcripts',
    actions: {
      extract: 'Extract from provided transcript text',
      'from-video': 'Transcribe Cloudflare video and extract',
      'from-url': 'Transcribe video from URL and extract',
      'quick-analyze': 'Quick analysis without clip generation',
    },
    capabilities: [
      'High-value moment detection using keyword density',
      'Automatic timestamp extraction',
      'AI-powered hook and caption generation',
      'Hashtag recommendations',
      'Text overlay suggestions',
      'Multi-platform optimization',
    ],
    limits: {
      maxMoments: 20,
      minTranscriptLength: 100,
    },
  });
});
