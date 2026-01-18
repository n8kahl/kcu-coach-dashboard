import { getServerSession } from 'next-auth';
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

// Helper to get authenticated user's Discord ID
export async function getAuthenticatedUser() {
  const session = await getServerSession();

  if (!session?.user) {
    return null;
  }

  const user = session.user as SessionUser;
  return user;
}

// Helper to get authenticated user's database record
export async function getAuthenticatedDbUser() {
  const sessionUser = await getAuthenticatedUser();

  if (!sessionUser?.discordId) {
    return null;
  }

  const { data: user, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('discord_id', sessionUser.discordId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  return user;
}

// Helper to get just the user ID
export async function getAuthenticatedUserId() {
  const sessionUser = await getAuthenticatedUser();

  if (!sessionUser?.discordId) {
    return null;
  }

  const { data: user, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('discord_id', sessionUser.discordId)
    .single();

  if (error || !user) {
    return null;
  }

  return user.id;
}
