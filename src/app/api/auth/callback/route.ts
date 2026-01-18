import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { exchangeDiscordCode, setSessionCookie } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    console.error('Discord OAuth error:', error);
    return NextResponse.redirect(`${baseUrl}/login?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=no_code`);
  }

  try {
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
      // Create new user - need to insert into both 'users' table (parent) and 'user_profiles' table
      // The user_profiles table has a foreign key constraint referencing users table
      const userId = randomUUID();
      console.log('Creating new user with id:', userId);

      // First, insert into the parent 'users' table
      const { error: usersInsertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          discord_id: discordUser.id,
          username: discordUser.username,
          email: discordUser.email || null,
          avatar_url: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
        });

      if (usersInsertError) {
        console.error('Error creating user in users table:', usersInsertError);
        return NextResponse.redirect(`${baseUrl}/login?error=create_failed`);
      }

      // Then, insert into user_profiles table (child)
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
        // Clean up the users table entry if profile creation failed
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

    console.log('Login successful, redirecting to dashboard');
    // Redirect to dashboard
    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch (error) {
    console.error('Auth callback error:', error);
    // Include more detail in the error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed&detail=${encodeURIComponent(errorMessage)}`);
  }
}
