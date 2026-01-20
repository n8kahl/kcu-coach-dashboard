// ============================================
// Brain Dump API Route
// Transforms raw ideas into Somesh-style content
// ============================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, internalError } from '@/lib/api-errors';
import { z } from 'zod';
import {
  generateFromBrainDump,
  BrainDumpPlatform,
  BrainDumpOutput,
} from '@/lib/social/content-generator';

// ============================================
// Request Validation
// ============================================

const BrainDumpRequestSchema = z.object({
  rawInput: z.string().min(10, 'Brain dump must be at least 10 characters').max(5000, 'Brain dump cannot exceed 5000 characters'),
  platforms: z.array(z.enum(['twitter', 'linkedin', 'instagram'])).min(1, 'Select at least one platform'),
});

// ============================================
// POST - Generate content from brain dump
// ============================================

export const POST = withErrorHandler(async (request: Request) => {
  // Require admin access
  await requireAdmin();

  // Parse and validate request body
  const body = await request.json();
  const { rawInput, platforms } = BrainDumpRequestSchema.parse(body);

  try {
    // Generate content using the brain dump function
    const result: BrainDumpOutput = await generateFromBrainDump(
      rawInput,
      platforms as BrainDumpPlatform[]
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Brain dump generation error:', error);

    const message = error instanceof Error
      ? `Content generation failed: ${error.message}`
      : 'Failed to generate content from brain dump';

    return internalError(message);
  }
});

// ============================================
// GET - Return brain dump feature info
// ============================================

export const GET = withErrorHandler(async () => {
  await requireAdmin();

  return NextResponse.json({
    success: true,
    feature: 'brain-dump',
    description: 'Transform raw ideas into Somesh-style viral social media content',
    platforms: ['twitter', 'linkedin', 'instagram'],
    limits: {
      minCharacters: 10,
      maxCharacters: 5000,
    },
    capabilities: [
      'Twitter threads',
      'LinkedIn professional posts',
      'Instagram carousels',
      'Automatic hashtag generation',
      'Tone matching score',
      'Platform-specific optimization',
    ],
  });
});
