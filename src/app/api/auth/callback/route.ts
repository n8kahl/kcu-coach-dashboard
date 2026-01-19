import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeDiscordCode,
  setSessionCookie,
  verifySignedState,
  findOrCreateUserInUsersTable,
  upsertUserProfile,
} from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Verify and parse signed state parameter (prevents tampering)
  let redirectTo = '/dashboard';
  if (state) {
    const stateData = verifySignedState(state);
    if (stateData && stateData.redirect && stateData.redirect.startsWith('/')) {
      redirectTo = stateData.redirect;
    } else if (!stateData) {
      // State signature invalid - possible CSRF attack
      console.warn('OAuth callback received invalid state signature');
      return NextResponse.redirect(`${baseUrl}/login?error=invalid_state`);
    }
  }

  if (error) {
    console.error('Discord OAuth error:', error);
    return NextResponse.redirect(`${baseUrl}/login?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=no_code`);
  }

  try {
    // Exchange code for Discord user info
    const discordUser = await exchangeDiscordCode(code);

    // Find existing user or create new one (NEVER deletes existing data)
    const { userId } = await findOrCreateUserInUsersTable(
      discordUser.id,
      randomUUID(),
      {
        username: discordUser.username,
        email: discordUser.email || null,
      }
    );

    // Upsert user profile (creates if new, updates if exists - preserves user data)
    const userProfile = await upsertUserProfile(userId, {
      id: discordUser.id,
      username: discordUser.username,
      email: discordUser.email || null,
      avatar: discordUser.avatar || null,
    });

    // Set session cookie
    await setSessionCookie({
      userId: userProfile.id,
      discordId: userProfile.discord_id,
      username: userProfile.discord_username,
      avatar: userProfile.avatar_url,
      isAdmin: userProfile.is_admin || false,
    });

    // Redirect to original destination or dashboard
    return NextResponse.redirect(`${baseUrl}${redirectTo}`);
  } catch (error) {
    console.error('Auth callback error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
  }
}
