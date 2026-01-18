import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { exchangeDiscordCode, setSessionCookie, verifySignedState } from '@/lib/auth';
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
    // Log environment info for debugging
    console.log('Auth callback - environment check:', {
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
    });

    // Exchange code for Discord user info
    console.log('Exchanging Discord code for user info...');
    const discordUser = await exchangeDiscordCode(code);
    console.log('Discord user retrieved:', discordUser.id, discordUser.username);

    // Check if user exists in our database (using user_profiles table)
    let { data: user, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('discord_id', discordUser.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected for new users)
      console.error('Error fetching user:', fetchError);
    }

    if (!user) {
      // No user_profile found - we need to ensure user exists in 'users' table first
      // (due to foreign key constraint user_profiles_id_fkey)

      // IMPORTANT: Clean up any stale/corrupted entries first
      // Delete any existing entries for this discord_id from both tables
      console.log('Cleaning up any existing entries for discord_id:', discordUser.id);

      // Delete from user_profiles first (child table)
      await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('discord_id', discordUser.id);

      // Delete from users table (parent table)
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('discord_id', discordUser.id);

      // Create fresh user with new UUID
      const userId = randomUUID();
      console.log('Creating fresh user with id:', userId);

      const { data: insertedUser, error: usersInsertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          discord_id: discordUser.id,
          username: discordUser.username,
          email: discordUser.email || null,
        })
        .select()
        .single();

      if (usersInsertError) {
        console.error('Error creating user in users table:', usersInsertError);
        return NextResponse.redirect(`${baseUrl}/login?error=create_failed`);
      }

      // Verify the user was actually created (RLS might silently block inserts)
      if (!insertedUser) {
        console.error('User insert returned no data - RLS may be blocking. Checking if user exists...');
        const { data: verifyUser, error: verifyError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id', userId)
          .single();

        if (verifyError || !verifyUser) {
          console.error('User verification failed:', verifyError);
          console.error('This may indicate RLS policies are blocking service role inserts.');
          console.error('Please check that SUPABASE_SERVICE_ROLE_KEY is set correctly.');
          return NextResponse.redirect(`${baseUrl}/login?error=user_creation_blocked`);
        }
      }

      console.log('User created successfully in users table:', userId);

      // Double-check user exists RIGHT before user_profiles insert
      const { data: checkUser, error: checkError } = await supabaseAdmin
        .from('users')
        .select('id, discord_id')
        .eq('id', userId)
        .single();

      console.log('Pre-insert verification:', {
        userExists: !!checkUser,
        userId: checkUser?.id,
        checkError: checkError?.message
      });

      if (!checkUser) {
        console.error('CRITICAL: User disappeared after creation! This suggests a trigger or RLS policy is deleting rows.');
        return NextResponse.redirect(`${baseUrl}/login?error=user_disappeared`);
      }

      // Create user_profiles entry
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: userId,
          discord_id: discordUser.id,
          username: discordUser.username,  // Required NOT NULL field
          discord_username: discordUser.username,
          email: discordUser.email || null,
          avatar_url: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
          experience_level: 'beginner',
          subscription_tier: 'free',
          is_admin: false,
          streak_days: 0,
          total_quizzes: 0,
          total_questions: 0,
          current_module: 'fundamentals',  // TEXT field, not number
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user profile:', createError);
        // Clean up the users table entry we just created
        await supabaseAdmin.from('users').delete().eq('id', userId);
        return NextResponse.redirect(`${baseUrl}/login?error=create_failed`);
      }

      user = newUser;
    } else {
      // Update existing user info
      await supabaseAdmin
        .from('user_profiles')
        .update({
          discord_username: discordUser.username,
          avatar_url: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    // Set session cookie (map user_profiles fields to session fields)
    console.log('Setting session cookie for user:', user.id);
    await setSessionCookie({
      userId: user.id,
      discordId: user.discord_id,
      username: user.discord_username,
      avatar: user.avatar_url,
      isAdmin: user.is_admin || false,
    });

    console.log('Login successful, redirecting to:', redirectTo);
    // Redirect to original destination or dashboard
    return NextResponse.redirect(`${baseUrl}${redirectTo}`);
  } catch (error) {
    console.error('Auth callback error:', error);
    // Include more detail in the error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed&detail=${encodeURIComponent(errorMessage)}`);
  }
}
