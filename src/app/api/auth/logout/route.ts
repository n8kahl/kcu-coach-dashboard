import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function GET() {
  await clearSessionCookie();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return NextResponse.redirect(`${baseUrl}/login`);
}

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
