/**
 * Trade Journal Single Trade API
 *
 * GET /api/trades/[id] - Get a single trade
 * PATCH /api/trades/[id] - Update a trade
 * DELETE /api/trades/[id] - Delete a trade
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/trades/[id]
 * Get a single trade by ID (must belong to authenticated user)
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: trade, error } = await supabaseAdmin
      .from('trade_journal')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    return NextResponse.json({ trade });
  } catch (error) {
    console.error('Error fetching trade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/trades/[id]
 * Update an existing trade (must belong to authenticated user)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify trade belongs to user
    const { data: existingTrade, error: fetchError } = await supabaseAdmin
      .from('trade_journal')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingTrade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Accept field aliases for backward compatibility
    const shares = body.shares ?? body.quantity;
    const isOptions = body.is_options ?? body.isOptions;

    // If LTP checklist fields are provided, recalculate LTP grade
    let ltpGradeUpdate = {};
    if (
      body.had_level !== undefined ||
      body.had_trend !== undefined ||
      body.had_patience_candle !== undefined ||
      body.followed_rules !== undefined
    ) {
      const hadLevel = body.had_level ?? false;
      const hadTrend = body.had_trend ?? false;
      const hadPatienceCandle = body.had_patience_candle ?? false;
      const followedRules = body.followed_rules ?? false;

      const ltpScore =
        (hadLevel ? 25 : 0) +
        (hadTrend ? 25 : 0) +
        (hadPatienceCandle ? 25 : 0) +
        (followedRules ? 25 : 0);

      const ltpGrade =
        ltpScore >= 100 ? 'A' : ltpScore >= 75 ? 'B' : ltpScore >= 50 ? 'C' : ltpScore >= 25 ? 'D' : 'F';

      const feedback: string[] = [];
      if (!hadLevel) feedback.push('Consider waiting for a key support/resistance level');
      if (!hadTrend) feedback.push('Trading with the trend increases probability of success');
      if (!hadPatienceCandle) feedback.push('Patience candles confirm entry setups');
      if (!followedRules) feedback.push('Following your trading rules is crucial for consistency');

      ltpGradeUpdate = {
        had_level: hadLevel,
        had_trend: hadTrend,
        had_patience_candle: hadPatienceCandle,
        followed_rules: followedRules,
        ltp_grade: {
          score: ltpScore,
          grade: ltpGrade,
          feedback,
        },
      };
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      ...ltpGradeUpdate,
      updated_at: new Date().toISOString(),
    };

    // Only include fields that are explicitly provided
    if (body.symbol !== undefined) updateData.symbol = body.symbol;
    if (body.direction !== undefined) updateData.direction = body.direction;
    if (body.entry_price !== undefined) updateData.entry_price = body.entry_price;
    if (body.exit_price !== undefined) updateData.exit_price = body.exit_price;
    if (shares !== undefined) updateData.shares = shares;
    if (isOptions !== undefined) updateData.is_options = isOptions;
    if (body.option_type !== undefined) updateData.option_type = body.option_type;
    if (body.strike !== undefined) updateData.strike = body.strike;
    if (body.expiration !== undefined) updateData.expiration = body.expiration;
    if (body.entry_time !== undefined) updateData.entry_time = body.entry_time;
    if (body.exit_time !== undefined) updateData.exit_time = body.exit_time;
    if (body.pnl !== undefined) updateData.pnl = body.pnl;
    if (body.pnl_percent !== undefined) updateData.pnl_percent = body.pnl_percent;
    if (body.setup_type !== undefined) updateData.setup_type = body.setup_type;
    if (body.emotions !== undefined) updateData.emotions = body.emotions;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.screenshot_url !== undefined) updateData.screenshot_url = body.screenshot_url;

    const { data: trade, error } = await supabaseAdmin
      .from('trade_journal')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trade });
  } catch (error) {
    console.error('Error updating trade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/trades/[id]
 * Delete a trade (must belong to authenticated user)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify trade belongs to user and delete
    const { error } = await supabaseAdmin
      .from('trade_journal')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
