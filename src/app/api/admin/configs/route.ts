import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET - Fetch all strategy configs
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can view configs
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: configs, error } = await supabaseAdmin
      .from('strategy_configs')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error('Error fetching configs:', error);
      return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
    }

    return NextResponse.json({ configs });
  } catch (error) {
    console.error('Error in configs GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a strategy config
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, config } = await request.json();

    if (!name || !config) {
      return NextResponse.json({ error: 'Name and config required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('strategy_configs')
      .update({
        config,
        updated_at: new Date().toISOString()
      })
      .eq('name', name)
      .select()
      .single();

    if (error) {
      console.error('Error updating config:', error);
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: data });
  } catch (error) {
    console.error('Error in configs PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new strategy config
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = session.userId;
    const { name, category, config } = await request.json();

    if (!name || !category || !config) {
      return NextResponse.json({ error: 'Name, category, and config required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('strategy_configs')
      .insert({
        name,
        category,
        config,
        is_active: true,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating config:', error);
      return NextResponse.json({ error: 'Failed to create config' }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: data });
  } catch (error) {
    console.error('Error in configs POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
