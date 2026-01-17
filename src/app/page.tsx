'use client';

import Link from 'next/link';
import { ArrowRight, Bot, BookOpen, LineChart, Target, Zap, Shield } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-dark-bg to-accent-900/20" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">KCU Coach</span>
          </div>
          <Link
            href="/login"
            className="btn-primary flex items-center gap-2"
          >
            Login with Discord
            <ArrowRight className="w-4 h-4" />
          </Link>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 lg:px-12">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm mb-8">
              <Zap className="w-4 h-4" />
              Powered by AI & KCU Methodology
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Your AI Trading{' '}
              <span className="text-gradient">Companion</span>
            </h1>

            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Master the LTP framework with real-time AI coaching, automated setup detection,
              and intelligent trade journaling. Trade with confidence, learn faster.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25"
              >
                Start Trading Smarter
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="https://discord.gg/kingcartel"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 bg-dark-card hover:bg-dark-border text-white font-semibold rounded-xl border border-dark-border transition-all duration-200 flex items-center justify-center gap-2"
              >
                Join Discord
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-24 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Everything You Need to Trade Better
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Built by traders, for traders. Every feature designed to help you master the KCU methodology.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Target className="w-6 h-6" />}
              title="Companion Mode"
              description="Real-time setup detection with LTP scoring. Get alerted when high-confluence setups are forming on your watchlist."
              href="/companion"
              gradient="from-green-500 to-emerald-500"
            />
            <FeatureCard
              icon={<Bot className="w-6 h-6" />}
              title="AI Coach"
              description="Your personal trading mentor powered by AI. Get guidance during trades, review your performance, and learn from mistakes."
              href="/coach"
              gradient="from-primary-500 to-blue-500"
            />
            <FeatureCard
              icon={<LineChart className="w-6 h-6" />}
              title="Trade Journal"
              description="Automatic journaling from followed alerts. Track emotions, mistakes, and lessons with detailed analytics."
              href="/journal"
              gradient="from-accent-500 to-pink-500"
            />
            <FeatureCard
              icon={<BookOpen className="w-6 h-6" />}
              title="Learning Center"
              description="Master the LTP framework, ORB breakouts, and order flow. Interactive lessons with quizzes and progress tracking."
              href="/progress"
              gradient="from-yellow-500 to-orange-500"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Live Alerts"
              description="Follow admin calls in real-time. Loading, Entering, Adding, TP, Exit - never miss an opportunity."
              href="/alerts"
              gradient="from-red-500 to-rose-500"
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Risk Management"
              description="Position sizing calculator, stop loss guidance, and portfolio heat tracking to protect your capital."
              href="/risk"
              gradient="from-cyan-500 to-teal-500"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-12">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-12 text-center gradient-border">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to Level Up Your Trading?
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Join traders who are using AI-powered tools to trade smarter, learn faster, and achieve consistency.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/25"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-border py-12 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-white">KCU Coach</span>
          </div>
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} KCU Coach. Not financial advice.
          </p>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="https://discord.gg/kingcartel" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              Discord
            </a>
            <a href="https://twitter.com/kingcartel" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
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
  href,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  gradient: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="glass-card-hover p-6 h-full">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-4`}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
    </Link>
  );
}
