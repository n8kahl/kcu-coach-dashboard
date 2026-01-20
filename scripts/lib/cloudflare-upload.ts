/**
 * Cloudflare Stream Upload Utilities for Bulk Import
 *
 * Direct upload to Cloudflare Stream using FormData.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================
// Types
// ============================================

interface UploadTokenResponse {
  result: {
    uploadURL: string;
    uid: string;
  };
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
}

interface VideoStatusResponse {
  result: {
    uid: string;
    status: {
      state: string;
      pctComplete?: string;
    };
    playback?: {
      hls?: string;
      dash?: string;
    };
    duration?: number;
    thumbnail?: string;
    meta?: Record<string, string>;
  };
  success: boolean;
}

export interface UploadResult {
  success: boolean;
  uid?: string;
  playbackUrl?: string;
  duration?: number;
  error?: string;
}

export type ProgressCallback = (percent: number, bytesUploaded: number, bytesTotal: number) => void;

// ============================================
// Configuration
// ============================================

function getCloudflareConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
  }

  return { accountId, apiToken };
}

// ============================================
// Upload Token
// ============================================

export async function getUploadToken(options: {
  maxDurationSeconds?: number;
  meta?: Record<string, string>;
}): Promise<{ uploadURL: string; uid: string }> {
  const { accountId, apiToken } = getCloudflareConfig();

  // Build allowed origins (strip protocol as Cloudflare requires)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let origin: string;
  try {
    origin = new URL(appUrl).host;
  } catch {
    origin = 'localhost:3000';
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxDurationSeconds: options.maxDurationSeconds || 7200, // 2 hours
        requireSignedURLs: false,
        allowedOrigins: [origin],
        meta: options.meta || {},
      }),
    }
  );

  const data: UploadTokenResponse = await response.json();

  if (!data.success || !data.result?.uploadURL) {
    const errorMsg = data.errors?.[0]?.message || data.messages?.[0] || 'Unknown error';
    throw new Error(`Failed to get upload token: ${errorMsg}`);
  }

  return {
    uploadURL: data.result.uploadURL,
    uid: data.result.uid,
  };
}

// ============================================
// Direct Upload via FormData (for files < 200MB)
// ============================================

const MAX_BASIC_UPLOAD_SIZE = 200 * 1024 * 1024; // 200MB
const TUS_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks

export async function uploadVideoWithFormData(
  filePath: string,
  uploadURL: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const fileBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  const fileSize = fileBuffer.length;

  // Cloudflare Direct Creator Upload accepts FormData POST
  const blob = new Blob([fileBuffer], { type: 'video/mp4' });
  const formData = new FormData();
  formData.append('file', blob, fileName);

  const response = await fetch(uploadURL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} ${errorText}`);
  }

  // Report 100% progress
  if (onProgress) {
    onProgress(100, fileSize, fileSize);
  }
}

// ============================================
// TUS Chunked Upload (for files >= 200MB)
// Uses Cloudflare Stream API directly with TUS protocol
// ============================================

export async function uploadVideoWithTus(
  filePath: string,
  meta?: Record<string, string>,
  onProgress?: ProgressCallback
): Promise<string> {
  const { accountId, apiToken } = getCloudflareConfig();
  const fileBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  const fileSize = fileBuffer.length;

  // Build metadata for TUS
  const tusMetadata = [
    `filename ${Buffer.from(fileName).toString('base64')}`,
    `filetype ${Buffer.from('video/mp4').toString('base64')}`,
  ];

  // Add custom meta
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      tusMetadata.push(`${key} ${Buffer.from(value).toString('base64')}`);
    }
  }

  // Step 1: Create the upload with POST to Stream API TUS endpoint
  const createResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(fileSize),
        'Upload-Metadata': tusMetadata.join(','),
      },
    }
  );

  if (!createResponse.ok && createResponse.status !== 201) {
    const errorText = await createResponse.text();
    throw new Error(`TUS create failed: ${createResponse.status} ${errorText}`);
  }

  // Get the Location header for PATCH requests
  const location = createResponse.headers.get('Location');
  if (!location) {
    throw new Error('TUS create did not return Location header');
  }

  // Extract video UID from the Location URL
  const uid = createResponse.headers.get('stream-media-id') || location.split('/').pop() || '';

  // Step 2: Upload file in chunks via PATCH with retry logic
  let offset = 0;
  const maxRetries = 3;

  while (offset < fileSize) {
    const chunkSize = Math.min(TUS_CHUNK_SIZE, fileSize - offset);
    const chunk = fileBuffer.subarray(offset, offset + chunkSize);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const patchResponse = await fetch(location, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(offset),
            'Content-Type': 'application/offset+octet-stream',
          },
          body: chunk,
        });

        if (!patchResponse.ok) {
          const errorText = await patchResponse.text();
          throw new Error(`HTTP ${patchResponse.status}: ${errorText}`);
        }

        // Get the new offset from the response
        const newOffset = patchResponse.headers.get('Upload-Offset');
        offset = newOffset ? parseInt(newOffset, 10) : offset + chunkSize;

        // Success - break retry loop
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    if (lastError) {
      throw new Error(`TUS PATCH failed at offset ${offset} after ${maxRetries} attempts: ${lastError.message}`);
    }

    // Report progress
    if (onProgress) {
      const percent = Math.round((offset / fileSize) * 100);
      onProgress(percent, offset, fileSize);
    }
  }

  return uid;
}

// ============================================
// Video Status Polling
// ============================================

export async function getVideoStatus(uid: string): Promise<VideoStatusResponse['result']> {
  const { accountId, apiToken } = getCloudflareConfig();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    }
  );

  const data: VideoStatusResponse = await response.json();

  if (!data.success) {
    throw new Error('Failed to get video status');
  }

  return data.result;
}

export async function waitForVideoReady(
  uid: string,
  maxWaitMs: number = 300000, // 5 minutes
  pollIntervalMs: number = 5000
): Promise<VideoStatusResponse['result']> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getVideoStatus(uid);

    if (status.status.state === 'ready') {
      return status;
    }

    if (status.status.state === 'error') {
      throw new Error('Video processing failed');
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Timeout waiting for video to be ready');
}

// ============================================
// Complete Upload Flow
// ============================================

export async function uploadVideo(
  filePath: string,
  meta?: Record<string, string>,
  onProgress?: ProgressCallback
): Promise<UploadResult> {
  try {
    // Get file size to determine upload method
    const fileSize = await getFileSize(filePath);

    let uid: string;

    // Choose upload method based on file size
    if (fileSize >= MAX_BASIC_UPLOAD_SIZE) {
      // Use TUS chunked upload directly to Stream API for large files
      uid = await uploadVideoWithTus(filePath, meta, onProgress);
    } else {
      // Use simple FormData upload via Direct Upload URL for smaller files
      const token = await getUploadToken({ meta });
      await uploadVideoWithFormData(filePath, token.uploadURL, onProgress);
      uid = token.uid;
    }

    // Wait for video to be processed (with short timeout for status)
    // We'll poll for ready status but not block too long
    try {
      const status = await waitForVideoReady(uid, 60000, 3000); // 1 minute max wait

      return {
        success: true,
        uid,
        playbackUrl: status.playback?.hls,
        duration: status.duration,
      };
    } catch {
      // Video uploaded but still processing - that's OK
      return {
        success: true,
        uid,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// Utility: Get File Size
// ============================================

export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
