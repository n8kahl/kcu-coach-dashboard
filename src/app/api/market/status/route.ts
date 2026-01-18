import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// GET - Fetch market status from Massive.com
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.MASSIVE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Market data not configured' }, { status: 503 });
    }

    const response = await fetch(
      `https://api.massive.com/v1/marketstatus/now?apikey=${apiKey}`
    );

    if (!response.ok) {
      console.error('Massive API error:', response.status);
      return NextResponse.json({
        market: 'unknown',
        afterHours: false,
        earlyHours: false
      });
    }

    const data = await response.json();

    return NextResponse.json({
      market: data.market,
      afterHours: data.afterHours,
      earlyHours: data.earlyHours,
      serverTime: data.serverTime,
    });
  } catch (error) {
    console.error('Error fetching market status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
