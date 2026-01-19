import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { marketDataService } from '@/lib/market-data';

// GET - Fetch market status and index quotes
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!marketDataService.isConfigured()) {
      return NextResponse.json({ error: 'Market data not configured' }, { status: 503 });
    }

    // Fetch market status and index quotes in parallel
    const [marketStatus, spyQuote, qqqQuote, vixQuote] = await Promise.all([
      marketDataService.getMarketStatus(),
      marketDataService.getQuote('SPY').catch(() => null),
      marketDataService.getQuote('QQQ').catch(() => null),
      marketDataService.getQuote('VIX').catch(() => null),
    ]);

    // Determine if market is open
    const isOpen = marketStatus.market === 'open';

    // Calculate time to close
    let timeToClose = '';
    if (isOpen) {
      const now = new Date();
      const closeTime = new Date(now);
      closeTime.setHours(16, 0, 0, 0); // 4 PM ET
      const diffMs = closeTime.getTime() - now.getTime();
      if (diffMs > 0) {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        timeToClose = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }
    }

    return NextResponse.json({
      spy: spyQuote ? { price: spyQuote.last, change: spyQuote.changePercent } : { price: 0, change: 0 },
      qqq: qqqQuote ? { price: qqqQuote.last, change: qqqQuote.changePercent } : { price: 0, change: 0 },
      vix: vixQuote ? { price: vixQuote.last, change: vixQuote.changePercent } : undefined,
      isOpen,
      timeToClose,
      // Also include raw status for compatibility
      market: isOpen ? 'open' : marketStatus.afterHours ? 'afterHours' : marketStatus.earlyHours ? 'earlyHours' : 'closed',
      afterHours: marketStatus.afterHours,
      earlyHours: marketStatus.earlyHours,
    });
  } catch (error) {
    console.error('Error fetching market status:', error);
    // Return safe defaults to prevent UI crash
    return NextResponse.json({
      spy: { price: 0, change: 0 },
      qqq: { price: 0, change: 0 },
      isOpen: false,
      timeToClose: '',
      market: 'unknown',
    });
  }
}
