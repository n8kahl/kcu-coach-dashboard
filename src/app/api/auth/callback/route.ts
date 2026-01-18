import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { exchangeDiscordCode, setSessionCookie } from '@/lib/auth';

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
    const discordUser = await exchangeDiscordCode(code);

    // Check if user exists in our database (using user_profiles table)
    let { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('discord_id', discordUser.id)
      .single();

    if (!user) {
      // Create new user in user_profiles table
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          discord_id: discordUser.id,
          discord_username: discordUser.username,
          avatar_url: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
          experience_level: 'beginner',
          is_admin: false,
          streak_days: 0,
          total_quizzes: 0,
          current_module: 1,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
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
    await setSessionCookie({
      userId: user.id,
      discordId: user.discord_id,
      username: user.discord_username,
      avatar: user.avatar_url,
      isAdmin: user.is_admin || false,
    });

    // Redirect to dashboard
    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
  }
}
