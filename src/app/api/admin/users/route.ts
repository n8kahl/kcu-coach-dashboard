import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export interface AdminUserResponse {
  id: string;
  username: string;
  discord_id: string;
  discord_username?: string;
  email: string | null;
  avatar_url: string | null;
  experience_level: string;
  subscription_tier: string;
  is_admin: boolean;
  streak_days: number;
  total_quizzes: number;
  total_questions: number;
  current_module: string;
  created_at: string;
  updated_at: string;
  disabled_at: string | null;
}

// GET - Fetch all users with pagination and search
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const search = searchParams.get('search') || '';
    const includeDisabled = searchParams.get('includeDisabled') === 'true';

    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact' });

    // Filter disabled users unless explicitly requested
    if (!includeDisabled) {
      query = query.is('disabled_at', null);
    }

    // Search by username, email, or discord_id
    if (search) {
      query = query.or(
        `username.ilike.%${search}%,email.ilike.%${search}%,discord_id.ilike.%${search}%,discord_username.ilike.%${search}%`
      );
    }

    // Order and paginate
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get aggregate stats
    const { data: statsData } = await supabaseAdmin
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .is('disabled_at', null);

    const { data: todayActive } = await supabaseAdmin
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .is('disabled_at', null);

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      stats: {
        totalUsers: statsData?.length ?? count ?? 0,
        activeToday: todayActive?.length ?? 0,
      },
    });
  } catch (error) {
    console.error('Error in users GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
