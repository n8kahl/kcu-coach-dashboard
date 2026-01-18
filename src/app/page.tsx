'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  BookOpen,
  Trophy,
  Share2,
  Users,
  Bot,
  ChevronRight,
  Zap,
  Target,
  Flame,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] bg-hex-pattern">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent-primary)]/10 via-transparent to-transparent" />

        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[var(--accent-primary)]">KCU</span>
              <span className="text-lg font-medium text-[var(--text-secondary)]">COACH</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/overview"
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Dashboard
              </Link>
              <Link href="/login">
                <Button variant="primary" size="sm">
                  Login with Discord
                </Button>
              </Link>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="gold" size="md" className="mb-6">
                KAY CAPITALS UNIVERSITY
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold text-[var(--text-primary)] mb-6"
            >
              STOP LOSING.
              <br />
              <span className="text-[var(--accent-primary)] glow-text-gold">START PRINTING.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto"
            >
              Master the LTP Framework with AI-powered coaching. Track your progress,
              log your trades, and share your wins with the community.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex items-center justify-center gap-4"
            >
              <a href="https://discord.gg/kaycapitals" target="_blank" rel="noopener noreferrer">
                <Button variant="primary" size="lg" icon={<Bot className="w-5 h-5" />}>
                  Join Discord
                </Button>
              </a>
              <Link href="/overview">
                <Button variant="secondary" size="lg" icon={<ChevronRight className="w-5 h-5" />} iconPosition="right">
                  View Dashboard
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">
            LEVELS • TRENDS • PATIENCE CANDLES
          </h2>
          <p className="text-[var(--text-tertiary)]">
            Everything you need to master day trading
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Bot className="w-6 h-6" />}
            title="AI Trading Coach"
            description="Get instant answers to your trading questions powered by Claude AI and KCU knowledge base"
            badge="Discord Bot"
            href="/overview"
          />
          <FeatureCard
            icon={<BookOpen className="w-6 h-6" />}
            title="Learning Progress"
            description="Track your journey through the LTP framework with quizzes and interactive lessons"
            href="/progress"
          />
          <FeatureCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Trade Journal"
            description="Log your trades, track LTP compliance, and get AI-powered insights on your performance"
            href="/journal"
          />
          <FeatureCard
            icon={<Trophy className="w-6 h-6" />}
            title="Achievements"
            description="Earn badges and track milestones as you develop discipline and consistency"
            href="/achievements"
          />
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="Leaderboard"
            description="Compete with other traders and climb the weekly rankings"
            href="/leaderboard"
          />
          <FeatureCard
            icon={<Share2 className="w-6 h-6" />}
            title="Win Cards"
            description="Create and share beautiful branded cards celebrating your trading wins"
            badge="New"
            href="/win-cards"
          />
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-[var(--bg-secondary)] border-y border-[var(--border-primary)] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <StatItem value="1,200+" label="Active Traders" />
            <StatItem value="50,000+" label="Questions Answered" />
            <StatItem value="15,000+" label="Trades Logged" />
            <StatItem value="85%" label="Avg LTP Compliance" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Card variant="glow" className="text-center py-12 px-8">
          <CardContent>
            <Flame className="w-12 h-12 text-[var(--accent-primary)] mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">
              Ready to Start Printing?
            </h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-xl mx-auto">
              Join the KCU Discord server and start your journey to becoming a disciplined,
              profitable day trader with the LTP framework.
            </p>
            <a href="https://discord.gg/kaycapitals" target="_blank" rel="noopener noreferrer">
              <Button variant="primary" size="lg" icon={<Bot className="w-5 h-5" />}>
                Join KCU Discord
              </Button>
            </a>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-primary)] py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[var(--accent-primary)]">KCU</span>
            <span className="text-sm text-[var(--text-tertiary)]">COACH</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            © 2024 Kay Capitals University. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://discord.gg/kaycapitals" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              Discord
            </a>
            <a href="https://twitter.com/kaycapitals" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  badge,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  href?: string;
}) {
  const content = (
    <Card hoverable className="h-full cursor-pointer">
      <CardContent>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-[var(--accent-primary-glow)] flex items-center justify-center text-[var(--accent-primary)]">
            {icon}
          </div>
          {badge && <Badge variant="gold" size="sm">{badge}</Badge>}
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
        <p className="text-sm text-[var(--text-tertiary)]">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      {href ? <Link href={href}>{content}</Link> : content}
    </motion.div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <p className="text-4xl font-bold text-[var(--accent-primary)] mb-2">{value}</p>
      <p className="text-sm text-[var(--text-tertiary)]">{label}</p>
    </motion.div>
  );
}
