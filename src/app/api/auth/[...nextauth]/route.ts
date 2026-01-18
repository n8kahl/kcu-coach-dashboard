import NextAuth from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import { upsertUserFromDiscord, getUserByDiscordId } from '@/lib/supabase';

const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify email guilds',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'discord' && profile) {
        // Upsert user in Supabase when they sign in
        const discordProfile = profile as {
          id: string;
          username: string;
          avatar?: string;
          email?: string;
        };

        await upsertUserFromDiscord({
          id: discordProfile.id,
          username: discordProfile.username,
          avatar: discordProfile.avatar,
          email: discordProfile.email,
        });
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      // Add Discord ID to the token on first sign in
      if (account && profile) {
        token.discordId = (profile as { id: string }).id;
      }
      return token;
    },
    async session({ session, token }) {
      // Add Discord ID and Supabase user data to the session
      if (token.discordId) {
        const dbUser = await getUserByDiscordId(token.discordId as string);
        if (dbUser) {
          session.user = {
            ...session.user,
            id: dbUser.id,
            discordId: dbUser.discord_id,
            username: dbUser.discord_username,
            currentModule: dbUser.current_module,
            experienceLevel: dbUser.experience_level,
            streakDays: dbUser.streak_days,
            totalQuizzes: dbUser.total_quizzes,
          };
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});

export { handler as GET, handler as POST };
