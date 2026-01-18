'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Shield, TrendingUp, Users, Loader2 } from 'lucide-react';

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const handleLogin = () => {
    // Trigger Discord OAuth flow with redirect URL
    const authUrl = new URL('/api/auth/discord', window.location.origin);
    authUrl.searchParams.set('redirect', redirectTo);
    window.location.href = authUrl.toString();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] bg-hex-pattern flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card variant="glow" padding="lg">
          <CardContent>
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-3xl font-bold text-[var(--accent-primary)]">KCU</span>
                <span className="text-xl font-medium text-[var(--text-secondary)]">COACH</span>
              </div>
              <Badge variant="gold" size="md">
                KAY CAPITALS UNIVERSITY
              </Badge>
            </div>

            {/* Headline */}
            <h1 className="text-2xl font-bold text-center text-[var(--text-primary)] mb-2">
              Welcome Back, Trader
            </h1>
            <p className="text-center text-[var(--text-tertiary)] mb-8">
              Sign in with your Discord account to access your dashboard
            </p>

            {/* Discord Login Button */}
            <Button
              variant="primary"
              size="lg"
              className="w-full mb-6"
              onClick={handleLogin}
              icon={
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              }
            >
              Continue with Discord
            </Button>

            {/* Benefits */}
            <div className="space-y-3">
              <BenefitItem
                icon={<TrendingUp className="w-4 h-4" />}
                text="Track your trades and LTP compliance"
              />
              <BenefitItem
                icon={<Bot className="w-4 h-4" />}
                text="AI-powered coaching and feedback"
              />
              <BenefitItem
                icon={<Users className="w-4 h-4" />}
                text="Compete on weekly leaderboards"
              />
              <BenefitItem
                icon={<Shield className="w-4 h-4" />}
                text="Synced with your Discord progress"
              />
            </div>

            {/* Footer */}
            <p className="text-xs text-center text-[var(--text-muted)] mt-8">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] bg-hex-pattern flex items-center justify-center p-6">
      <div className="flex items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
        <span className="text-[var(--text-secondary)]">Loading...</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function BenefitItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
      <span className="text-[var(--accent-primary)]">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
