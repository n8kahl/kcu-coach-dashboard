import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// GET - Get current session status
export async function GET() {
  try {
    const session = await getSession();

    if (!session.user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.user.username,
        isAdmin: session.isAdmin,
        image: session.user.image,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({
      authenticated: false,
      error: 'Session check failed',
    });
  }
}
