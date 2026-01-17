import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase';

const SESSION_COOKIE_NAME = 'kcu_session';

export interface Session {
  userId: string;
  discordId: string;
  username: string;
  avatar?: string;
  isAdmin: boolean;
  expiresAt: number;
}

// Create a session token
export function createSessionToken(session: Omit<Session, 'expiresAt'>): string {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const sessionData: Session = { ...session, expiresAt };
  return Buffer.from(JSON.stringify(sessionData)).toString('base64');
}

// Parse session token
export function parseSessionToken(token: string): Session | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const session: Session = JSON.parse(decoded);

    if (session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

// Get current session from cookies (server-side)
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  return parseSessionToken(sessionCookie.value);
}

// Get authenticated user ID (server-side)
export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.userId || null;
}

// Get authenticated user (server-side)
export async function getAuthenticatedUser() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', session.userId)
    .single();

  return user;
}

// Check if user is admin
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.isAdmin || false;
}

// Set session cookie
export async function setSessionCookie(session: Omit<Session, 'expiresAt'>) {
  const token = createSessionToken(session);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

// Clear session cookie
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Discord OAuth helpers
export function getDiscordOAuthUrl(): string {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || '');
  const scope = encodeURIComponent('identify email');

  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
}

export async function exchangeDiscordCode(code: string) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;

  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri!,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange code for token');
  }

  const tokens = await tokenResponse.json();

  // Get user info
  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to get user info');
  }

  return userResponse.json();
}
