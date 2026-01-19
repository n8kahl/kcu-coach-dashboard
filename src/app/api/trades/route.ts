import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const symbol = searchParams.get('symbol');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabaseAdmin
      .from('trade_journal')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('entry_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (symbol) {
      query = query.eq('symbol', symbol);
    }

    if (startDate) {
      query = query.gte('entry_time', startDate);
    }

    if (endDate) {
      query = query.lte('entry_time', endDate);
    }

    const { data: trades, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trades, total: count });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Accept field aliases for backward compatibility
    // shares = body.shares ?? body.quantity ?? 1
    const shares = body.shares ?? body.quantity ?? 1;
    // is_options = body.is_options ?? body.isOptions ?? false
    const isOptions = body.is_options ?? body.isOptions ?? false;

    // Calculate LTP grade from checklist fields
    // Each field is worth 25 points for a max score of 100
    const hadLevel = body.had_level ?? false;
    const hadTrend = body.had_trend ?? false;
    const hadPatienceCandle = body.had_patience_candle ?? false;
    const followedRules = body.followed_rules ?? false;

    const ltpScore =
      (hadLevel ? 25 : 0) +
      (hadTrend ? 25 : 0) +
      (hadPatienceCandle ? 25 : 0) +
      (followedRules ? 25 : 0);

    // Grade thresholds: A=100, B=75, C=50, D=25, F=0
    const ltpGrade =
      ltpScore >= 100 ? 'A' : ltpScore >= 75 ? 'B' : ltpScore >= 50 ? 'C' : ltpScore >= 25 ? 'D' : 'F';

    const feedback: string[] = [];
    if (!hadLevel) feedback.push('Consider waiting for a key support/resistance level');
    if (!hadTrend) feedback.push('Trading with the trend increases probability of success');
    if (!hadPatienceCandle) feedback.push('Patience candles confirm entry setups');
    if (!followedRules) feedback.push('Following your trading rules is crucial for consistency');

    const tradeData = {
      user_id: userId,
      symbol: body.symbol || 'SPY',
      direction: body.direction,
      entry_price: body.entry_price,
      exit_price: body.exit_price,
      shares,
      is_options: isOptions,
      option_type: body.option_type || null,
      strike: body.strike || null,
      expiration: body.expiration || null,
      entry_time: body.entry_time,
      exit_time: body.exit_time,
      pnl: body.pnl,
      pnl_percent: body.pnl_percent,
      setup_type: body.setup_type,
      had_level: hadLevel,
      had_trend: hadTrend,
      had_patience_candle: hadPatienceCandle,
      followed_rules: followedRules,
      emotions: body.emotions || 'calm',
      notes: body.notes || null,
      screenshot_url: body.screenshot_url || null,
      ltp_grade: {
        score: ltpScore,
        grade: ltpGrade,
        feedback,
      },
    };

    const { data: trade, error } = await supabaseAdmin
      .from('trade_journal')
      .insert(tradeData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trade });
  } catch (error) {
    console.error('Error creating trade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
