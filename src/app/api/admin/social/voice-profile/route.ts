// ============================================
// Voice Profile API Route
// Updates and retrieves the hybrid voice profile
// for Somesh's Instagram + YouTube voice data
// ============================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, internalError, badRequest } from '@/lib/api-errors';
import { z } from 'zod';
import {
  updateVoiceProfile,
  getHybridVoiceProfile,
  HybridVoiceProfile,
} from '@/lib/social/tone-analyzer';

// ============================================
// Request Validation
// ============================================

const UpdateProfileSchema = z.object({
  instagramHandle: z.string().optional().default('kaycapitals'),
  youtubeChannelId: z.string().optional(),
  forceRefresh: z.boolean().optional().default(false),
});

// ============================================
// POST - Update voice profile from fresh data
// ============================================

export const POST = withErrorHandler(async (request: Request) => {
  await requireAdmin();

  const body = await request.json();
  const { instagramHandle, youtubeChannelId, forceRefresh } = UpdateProfileSchema.parse(body);

  try {
    const result = await updateVoiceProfile({
      instagramHandle,
      youtubeChannelId,
      forceRefresh,
    });

    if (!result.success) {
      return badRequest(result.error || 'Failed to update voice profile');
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: result.profile,
        dataCollected: result.dataCollected,
      },
    });
  } catch (error) {
    console.error('Voice profile update error:', error);

    const message = error instanceof Error
      ? `Update failed: ${error.message}`
      : 'Failed to update voice profile';

    return internalError(message);
  }
});

// ============================================
// GET - Retrieve current voice profile
// ============================================

export const GET = withErrorHandler(async () => {
  await requireAdmin();

  try {
    const profile = await getHybridVoiceProfile();

    if (!profile) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No voice profile found. Run POST to create one.',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        profile,
        lastUpdated: profile.lastUpdated,
        dataSources: profile.dataSourcesUsed,
      },
    });
  } catch (error) {
    console.error('Voice profile fetch error:', error);

    const message = error instanceof Error
      ? `Fetch failed: ${error.message}`
      : 'Failed to fetch voice profile';

    return internalError(message);
  }
});
