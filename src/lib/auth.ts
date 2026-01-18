import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from './supabase';

// Extended session user type
export interface SessionUser {
  id?: string;
  discordId?: string;
  username?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

// Helper to get authenticated user from Supabase
export async function getAuthenticatedUser() {
  const supabase = createServerComponentClient({ cookies });

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return null;
  }

  const user: SessionUser = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
    image: session.user.user_metadata?.avatar_url,
    discordId: session.user.user_metadata?.provider_id,
    username: session.user.user_metadata?.custom_claims?.global_name || session.user.user_metadata?.name,
  };

  return user;
}

// Helper to get authenticated user's database record
export async function getAuthenticatedDbUser() {
  const sessionUser = await getAuthenticatedUser();

  if (!sessionUser?.id) {
    return null;
  }

  // Try to find by auth user id first, then by discord_id
  const { data: user, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('id', sessionUser.id)
    .single();

  if (error) {
    // Try by discord_id as fallback
    if (sessionUser.discordId) {
      const { data: discordUser, error: discordError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('discord_id', sessionUser.discordId)
        .single();

      if (!discordError && discordUser) {
        return discordUser;
      }
    }
    console.error('Error fetching user:', error);
    return null;
  }

  return user;
}

// Helper to get just the user ID
export async function getAuthenticatedUserId() {
  const sessionUser = await getAuthenticatedUser();

  if (!sessionUser?.id) {
    return null;
  }

  return sessionUser.id;
}
