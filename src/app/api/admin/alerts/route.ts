import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser, getAuthenticatedUserId } from '@/lib/auth';

// Alert types with their display info
const ALERT_TYPES = {
  loading: { emoji: '👀', label: 'Loading', description: 'Watching position' },
  entering: { emoji: '🎯', label: 'Entering', description: 'Taking position' },
  adding: { emoji: '➕', label: 'Adding', description: 'Adding to position' },
  take_profit: { emoji: '💰', label: 'Take Profit', description: 'Partial exit' },
  exiting: { emoji: '🚪', label: 'Exiting', description: 'Closing position' },
  stopped_out: { emoji: '🚫', label: 'Stopped Out', description: 'Hit stop loss' },
  update: { emoji: '📝', label: 'Update', description: 'General update' }
};

// GET /api/admin/alerts - Get admin alerts (public, all users can see)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const alertType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const parentId = searchParams.get('parentId'); // Get chain of alerts

    let query = supabaseAdmin
      .from('admin_alerts')
      .select(`
        *,
        admin:user_profiles!admin_id(discord_username, avatar_url)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    if (alertType) {
      query = query.eq('alert_type', alertType);
    }

    if (parentId) {
      // Get the full chain: parent and all children
      query = query.or(`id.eq.${parentId},parent_alert_id.eq.${parentId}`);
    }

    const { data: alerts, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get active trades (loading or entering without exit)
    const { data: activeTrades } = await supabaseAdmin
      .from('admin_alerts')
      .select('*')
      .in('alert_type', ['loading', 'entering', 'adding'])
      .order('created_at', { ascending: false })
      .limit(20);

    // Filter to only truly active (no exit alert)
    const activeTradeIds = new Set<string>();
    const exitedParents = new Set<string>();

    for (const alert of alerts || []) {
      if (['exiting', 'stopped_out'].includes(alert.alert_type) && alert.parent_alert_id) {
        exitedParents.add(alert.parent_alert_id);
      }
    }

    const active = (activeTrades || []).filter(t => {
      if (exitedParents.has(t.id)) return false;
      if (t.parent_alert_id && exitedParents.has(t.parent_alert_id)) return false;
      return true;
    });

    return NextResponse.json({
      alerts: alerts || [],
      activeTrades: active,
      alertTypes: ALERT_TYPES
    });
  } catch (error) {
    console.error('Error fetching admin alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/alerts - Create new admin alert (admin only)
export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    const { alertType, symbol, direction } = body;

    if (!alertType || !symbol || !direction) {
      return NextResponse.json({
        error: 'alertType, symbol, and direction are required'
      }, { status: 400 });
    }

    if (!Object.keys(ALERT_TYPES).includes(alertType)) {
      return NextResponse.json({
        error: `Invalid alertType. Must be one of: ${Object.keys(ALERT_TYPES).join(', ')}`
      }, { status: 400 });
    }

    if (!['long', 'short'].includes(direction)) {
      return NextResponse.json({
        error: 'direction must be "long" or "short"'
      }, { status: 400 });
    }

    // Create the alert
    const alertData = {
      admin_id: userId,
      alert_type: alertType,
      symbol: symbol.toUpperCase(),
      direction,
      contract_details: body.contractDetails,
      entry_price: body.entryPrice,
      current_price: body.currentPrice,
      stop_loss: body.stopLoss,
      target_1: body.target1,
      target_1_action: body.target1Action,
      target_2: body.target2,
      target_2_action: body.target2Action,
      exit_price: body.exitPrice,
      exit_quantity: body.exitQuantity,
      realized_pnl: body.realizedPnl,
      realized_pnl_percent: body.realizedPnlPercent,
      ltp_justification: body.ltpJustification,
      level_description: body.levelDescription,
      trend_description: body.trendDescription,
      patience_description: body.patienceDescription,
      risk_notes: body.riskNotes,
      position_size: body.positionSize,
      max_risk: body.maxRisk,
      parent_alert_id: body.parentAlertId,
      broadcast_discord: body.broadcastDiscord ?? true,
      broadcast_web: body.broadcastWeb ?? true,
      broadcast_email: body.broadcastEmail ?? false,
      coach_message: body.coachMessage
    };

    const { data: alert, error } = await supabaseAdmin
      .from('admin_alerts')
      .insert(alertData)
      .select(`
        *,
        admin:user_profiles!admin_id(discord_username, avatar_url)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Queue broadcasts (would be a background job in production)
    if (alertData.broadcast_discord || alertData.broadcast_web) {
      await queueAlertBroadcast(alert);
    }

    return NextResponse.json({
      message: 'Alert created successfully',
      alert
    });
  } catch (error) {
    console.error('Error creating admin alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper to queue alert broadcast
async function queueAlertBroadcast(alert: any) {
  // In production, this would add to a job queue (Bull, etc.)
  // For now, we'll insert into a delivery queue table

  // Get all users who should receive this alert
  // For admin alerts, typically all active users get notified

  console.log(`Alert broadcast queued for alert ${alert.id}`);

  // You could also emit to a WebSocket/SSE channel here
  // for real-time delivery
}
