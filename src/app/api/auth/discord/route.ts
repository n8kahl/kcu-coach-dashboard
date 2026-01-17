import { NextResponse } from 'next/server';
import { getDiscordOAuthUrl } from '@/lib/auth';

export async function GET() {
  const url = getDiscordOAuthUrl();
  return NextResponse.redirect(url);
}
