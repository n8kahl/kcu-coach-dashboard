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
  isAdmin?: boolean;
}

export interface Session {
  user: SessionUser | null;
  // Convenience properties for backward compatibility with API routes
  userId?: string;
  isAdmin?: boolean;
}

// Discord OAuth configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

// Get Discord OAuth URL
export function getDiscordOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email guilds',
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

// Exchange Discord code for user info
export async function exchangeDiscordCode(code: string) {
  // Exchange code for tokens
  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange code for tokens');
  }

  const tokens = await tokenResponse.json();

  // Get user info
  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch user info');
  }

  return userResponse.json();
}

// Session cookie helpers
const SESSION_COOKIE_NAME = 'kcu_session';

export async function setSessionCookie(userData: {
  userId: string;
  discordId: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
}) {
  const cookieStore = await cookies();
  const sessionData = Buffer.from(JSON.stringify(userData)).toString('base64');

  cookieStore.set(SESSION_COOKIE_NAME, sessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<Session> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return { user: null };
    }

    const userData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());

    return {
      user: {
        id: userData.userId,
        discordId: userData.discordId,
        username: userData.username,
        image: userData.avatar,
        isAdmin: userData.isAdmin,
      },
      // Convenience properties for API routes
      userId: userData.userId,
      isAdmin: userData.isAdmin,
    };
  } catch {
    return { user: null };
  }
}

// Helper to get authenticated user from Supabase (alternative method)
export async function getAuthenticatedUser() {
  const session = await getSession();
  return session.user;
}

// Helper to get authenticated user's database record
export async function getAuthenticatedDbUser() {
  const sessionUser = await getAuthenticatedUser();

  if (!sessionUser?.id) {
    return null;
  }

  // Try to find by id first
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
