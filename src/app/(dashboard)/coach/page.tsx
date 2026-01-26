'use client';

// Force dynamic rendering to prevent navigation caching issues
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAIContext } from '@/components/ai/AIContextProvider';
import { Loader2, Sparkles } from 'lucide-react';

/**
 * AI Coach Page - Redirect
 *
 * This page has been deprecated in favor of the AI Command Center panel.
 * When users navigate here, we:
 * 1. Open the AI Command Center panel
 * 2. Redirect them to the Overview page
 *
 * The AI Coach is now accessible from anywhere via:
 * - Clicking "AI Coach" in the sidebar
 * - Pressing Cmd+J (or Ctrl+J on Windows)
 */
export default function CoachPage() {
  const router = useRouter();

  // Try to use AI context to open the panel
  let setPanel: ((state: 'collapsed' | 'expanded' | 'focused') => void) | null = null;
  try {
    const context = useAIContext();
    setPanel = context.setPanel;
  } catch {
    // Context not available
  }

  useEffect(() => {
    // Open the AI Command Center panel
    if (setPanel) {
      setPanel('expanded');
    }

    // Redirect to overview after a brief delay
    const timer = setTimeout(() => {
      router.replace('/overview');
    }, 500);

    return () => clearTimeout(timer);
  }, [router, setPanel]);

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)]">
      <div className="text-center">
        <div className="w-16 h-16 bg-[var(--accent-primary-glow)] flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-[var(--accent-primary)] animate-pulse" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          AI Coach has moved!
        </h2>
        <p className="text-[var(--text-tertiary)] mb-4 max-w-md">
          The AI Coach is now available as a side panel from anywhere in the app.
          Use <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]">Cmd+J</kbd> to toggle it anytime.
        </p>
        <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Redirecting...</span>
        </div>
      </div>
    </div>
  );
}
