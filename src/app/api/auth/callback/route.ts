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

    // Check if user exists in our database
    let { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('discord_id', discordUser.id)
      .single();

    if (!user) {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          discord_id: discordUser.id,
          email: discordUser.email,
          username: discordUser.username,
          avatar: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
          subscription_tier: 'free',
          is_admin: false,
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
        .from('users')
        .update({
          email: discordUser.email,
          username: discordUser.username,
          avatar: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    // Set session cookie
    await setSessionCookie({
      userId: user.id,
      discordId: user.discord_id,
      username: user.username,
      avatar: user.avatar,
      isAdmin: user.is_admin,
    });

    // Redirect to dashboard
    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
  }
}
