import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Railway deployment
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  });
}

// Mark as dynamic to prevent caching
export const dynamic = 'force-dynamic';
