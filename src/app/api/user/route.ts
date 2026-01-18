import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser, getAuthenticatedDbUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthenticatedDbUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { current_module, experience_level, preferred_symbols, notification_preferences } = body;

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        ...(current_module && { current_module }),
        ...(experience_level && { experience_level }),
        ...(preferred_symbols && { preferred_symbols }),
        ...(notification_preferences && { notification_preferences }),
        updated_at: new Date().toISOString(),
      })
      .eq('discord_id', sessionUser.discordId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
