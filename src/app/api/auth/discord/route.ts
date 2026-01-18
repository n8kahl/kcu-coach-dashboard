import { NextRequest, NextResponse } from 'next/server';
import { getDiscordOAuthUrl } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // Get redirect URL from query params and pass it as state
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/dashboard';
  const url = getDiscordOAuthUrl(redirectTo);
  return NextResponse.redirect(url);
}
