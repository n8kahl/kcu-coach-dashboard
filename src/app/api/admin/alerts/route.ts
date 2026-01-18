import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { broadcastAdminAlert } from '@/lib/broadcast';

// GET - Fetch admin alerts
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabaseAdmin
      .from('admin_alerts')
      .select(`
        *,
        admin:users!admin_id (
          username,
          avatar
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    const { data: alerts, error } = await query;

    if (error) {
      console.error('Error fetching alerts:', error);
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Error in alerts GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create and broadcast an admin alert
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminId = session.userId;

    const body = await request.json();
    const {
      symbol,
      direction,
      alertType,
      contract,
      entryPrice,
      stopLoss,
      targets,
      message,
      ltpJustification
    } = body;

    if (!symbol || !direction || !alertType) {
      return NextResponse.json(
        { error: 'Symbol, direction, and alertType required' },
        { status: 400 }
      );
    }

    // Insert alert into database
    const { data: alert, error } = await supabaseAdmin
      .from('admin_alerts')
      .insert({
        admin_id: adminId,
        symbol: symbol.toUpperCase(),
        direction,
        alert_type: alertType,
        contract,
        entry_price: entryPrice,
        stop_loss: stopLoss,
        targets,
        message,
        ltp_justification: ltpJustification,
        is_active: true
      })
      .select(`
        *,
        admin:users!admin_id (
          username,
          avatar
        )
      `)
      .single();

    if (error) {
      console.error('Error creating alert:', error);
      return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
    }

    // Broadcast to all connected users via SSE
    broadcastAdminAlert({
      id: alert.id,
      alertType: alert.alert_type,
      symbol: alert.symbol,
      direction: alert.direction,
      entryPrice: alert.entry_price,
      stopLoss: alert.stop_loss,
      targets: alert.targets,
      message: alert.message,
      admin: {
        username: alert.admin?.username || 'Coach',
        avatar: alert.admin?.avatar
      }
    });

    return NextResponse.json({ success: true, alert });
  } catch (error) {
    console.error('Error in alerts POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an alert (e.g., mark as inactive)
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, isActive, message } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Alert ID required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('admin_alerts')
      .update({
        ...(isActive !== undefined && { is_active: isActive }),
        ...(message && { message })
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating alert:', error);
      return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
    }

    return NextResponse.json({ success: true, alert: data });
  } catch (error) {
    console.error('Error in alerts PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
