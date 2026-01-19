import { cookies } from 'next/headers';
import { createHmac } from 'crypto';
import { supabaseAdmin } from './supabase';
import {
  createSessionToken,
  verifySessionToken,
  shouldRefreshSession,
  refreshSessionToken,
  type SessionPayload,
} from './jwt';

// Get signing secret for OAuth state
function getStateSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'development') {
      return 'development-secret-key-change-in-production-32chars';
    }
    throw new Error('SESSION_SECRET is required for OAuth state signing');
  }
  return secret;
}

// Create signed OAuth state
function createSignedState(data: Record<string, string>): string {
  const payload = JSON.stringify(data);
  const signature = createHmac('sha256', getStateSecret())
    .update(payload)
    .digest('hex')
    .slice(0, 16); // Use first 16 chars of signature
  return Buffer.from(`${signature}:${payload}`).toString('base64');
}

// Verify and parse signed OAuth state
export function verifySignedState(state: string): Record<string, string> | null {
  try {
    const decoded = Buffer.from(state, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) return null;

    const signature = decoded.slice(0, colonIndex);
    const payload = decoded.slice(colonIndex + 1);

    const expectedSignature = createHmac('sha256', getStateSecret())
      .update(payload)
      .digest('hex')
      .slice(0, 16);

    if (signature !== expectedSignature) {
      console.error('OAuth state signature mismatch - possible tampering');
      return null;
    }

    return JSON.parse(payload);
  } catch (error) {
    console.error('Failed to verify OAuth state:', error);
    return null;
  }
}

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
const DISCORD_REDIRECT_URI = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || process.env.DISCORD_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

// Get Discord OAuth URL with cryptographically signed state
export function getDiscordOAuthUrl(redirectTo: string = '/dashboard'): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email guilds',
    state: createSignedState({ redirect: redirectTo }),
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

/**
 * Create and set a secure JWT session cookie
 */
export async function setSessionCookie(userData: {
  userId: string;
  discordId: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
}) {
  const cookieStore = await cookies();

  // Create signed JWT token
  const token = await createSessionToken({
    userId: userData.userId,
    discordId: userData.discordId,
    username: userData.username,
    avatar: userData.avatar || undefined,
    isAdmin: userData.isAdmin,
  });

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get the current session from the JWT cookie
 * Automatically refreshes the token if close to expiring
 */
export async function getSession(): Promise<Session> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return { user: null };
    }

    // Verify the JWT token
    const payload = await verifySessionToken(sessionCookie.value);

    if (!payload) {
      // Token is invalid or expired - clear it
      cookieStore.delete(SESSION_COOKIE_NAME);
      return { user: null };
    }

    // Refresh token if close to expiring
    if (shouldRefreshSession(payload)) {
      try {
        const newToken = await refreshSessionToken(payload);
        cookieStore.set(SESSION_COOKIE_NAME, newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/',
        });
      } catch (refreshError) {
        // If refresh fails, continue with current session
        console.error('Failed to refresh session:', refreshError);
      }
    }

    return {
      user: {
        id: payload.userId,
        discordId: payload.discordId,
        username: payload.username,
        image: payload.avatar,
        isAdmin: payload.isAdmin,
      },
      // Convenience properties for API routes
      userId: payload.userId,
      isAdmin: payload.isAdmin,
    };
  } catch (error) {
    console.error('Session error:', error);
    return { user: null };
  }
}

/**
 * Get the raw session payload (for advanced use cases)
 */
export async function getSessionPayload(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    return await verifySessionToken(sessionCookie.value);
  } catch {
    return null;
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

/**
 * Require authentication - throws if not authenticated
 * Use in API routes: const session = await requireAuth();
 */
export async function requireAuth(): Promise<Session & { user: SessionUser; userId: string }> {
  const session = await getSession();

  if (!session.user || !session.userId) {
    throw new Error('Authentication required');
  }

  return session as Session & { user: SessionUser; userId: string };
}

/**
 * Require admin authentication - throws if not authenticated or not admin
 */
export async function requireAdmin(): Promise<Session & { user: SessionUser; userId: string; isAdmin: true }> {
  const session = await requireAuth();

  if (!session.isAdmin) {
    throw new Error('Admin access required');
  }

  return session as Session & { user: SessionUser; userId: string; isAdmin: true };
}

// ============================================================================
// User Management Helpers (for OAuth callback)
// ============================================================================

export interface DiscordUserData {
  id: string;
  username: string;
  email?: string | null;
  avatar?: string | null;
}

export interface UserProfile {
  id: string;
  discord_id: string;
  username: string;
  discord_username: string;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  experience_level: string;
  subscription_tier: string;
  streak_days: number;
  total_quizzes: number;
  total_questions: number;
  current_module: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Find existing user by Discord ID, or create a new one if not found.
 * NEVER deletes existing data - preserves user ID across logins.
 *
 * @param discordId - The Discord user ID
 * @param newUserId - UUID to use if creating a new user
 * @param discordData - Discord user data for creating new user
 * @returns The user ID (existing or newly created)
 */
export async function findOrCreateUserInUsersTable(
  discordId: string,
  newUserId: string,
  discordData: { username: string; email?: string | null }
): Promise<{ userId: string; isNew: boolean }> {
  // First, check if user already exists in users table
  const { data: existingUser, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('discord_id', discordId)
    .single();

  if (existingUser && !fetchError) {
    // User exists - return existing ID
    return { userId: existingUser.id, isNew: false };
  }

  // User doesn't exist - create new entry
  // Note: PGRST116 means "no rows found" which is expected for new users
  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Database error checking user: ${fetchError.message}`);
  }

  const { data: createdUser, error: insertError } = await supabaseAdmin
    .from('users')
    .insert({
      id: newUserId,
      discord_id: discordId,
      username: discordData.username,
      email: discordData.email || null,
    })
    .select('id')
    .single();

  if (insertError) {
    // Handle unique constraint violation (race condition - user was created by another request)
    if (insertError.code === '23505') {
      const { data: raceUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('discord_id', discordId)
        .single();

      if (raceUser) {
        return { userId: raceUser.id, isNew: false };
      }
    }
    throw new Error(`Failed to create user: ${insertError.message}`);
  }

  if (!createdUser) {
    throw new Error('User creation returned no data');
  }

  return { userId: createdUser.id, isNew: true };
}

/**
 * Upsert user profile - creates if not exists, updates if exists.
 * NEVER deletes existing data.
 *
 * @param userId - The user's UUID (from users table)
 * @param discordData - Discord user data
 * @returns The user profile
 */
export async function upsertUserProfile(
  userId: string,
  discordData: DiscordUserData
): Promise<UserProfile> {
  const avatarUrl = discordData.avatar
    ? `https://cdn.discordapp.com/avatars/${discordData.id}/${discordData.avatar}.png`
    : null;

  // Check if profile exists
  const { data: existingProfile, error: fetchError } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (existingProfile && !fetchError) {
    // Profile exists - update only Discord-related fields (preserve user data)
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        discord_username: discordData.username,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    return updatedProfile as UserProfile;
  }

  // Profile doesn't exist - create new one with defaults
  // Note: PGRST116 means "no rows found" which is expected
  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Database error checking profile: ${fetchError.message}`);
  }

  const { data: newProfile, error: insertError } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      id: userId,
      discord_id: discordData.id,
      username: discordData.username,
      discord_username: discordData.username,
      email: discordData.email || null,
      avatar_url: avatarUrl,
      experience_level: 'beginner',
      subscription_tier: 'free',
      is_admin: false,
      streak_days: 0,
      total_quizzes: 0,
      total_questions: 0,
      current_module: 'fundamentals',
    })
    .select()
    .single();

  if (insertError) {
    // Handle race condition - profile was created by another request
    if (insertError.code === '23505') {
      const { data: raceProfile, error: raceError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (raceProfile && !raceError) {
        return raceProfile as UserProfile;
      }
    }
    throw new Error(`Failed to create profile: ${insertError.message}`);
  }

  if (!newProfile) {
    throw new Error('Profile creation returned no data');
  }

  return newProfile as UserProfile;
}
