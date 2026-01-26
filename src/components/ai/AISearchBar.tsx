'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  Loader2,
  BookOpen,
  BarChart3,
  Target,
  History,
  Sparkles,
  ArrowRight,
  Command,
  FileText,
  Video,
  TrendingUp,
} from 'lucide-react';

// ============================================
// Types
// ============================================

export interface SearchResult {
  id: string;
  type: 'trade' | 'lesson' | 'video' | 'setup' | 'concept';
  title: string;
  description: string;
  url?: string;
  relevance: number;
  metadata?: Record<string, unknown>;
}

export interface SearchInterpretation {
  originalQuery: string;
  interpretation: string;
  intent: 'search' | 'question' | 'action';
  scope: string[];
  suggestions: string[];
}

interface AISearchBarProps {
  placeholder?: string;
  scope?: 'all' | 'trades' | 'lessons' | 'videos' | 'setups';
  onResultSelect?: (result: SearchResult) => void;
  onAskCoach?: (query: string) => void;
  className?: string;
  autoFocus?: boolean;
}

// ============================================
// Search Bar Component
// ============================================

export function AISearchBar({
  placeholder = 'Search or ask anything...',
  scope = 'all',
  onResultSelect,
  onAskCoach,
  className,
  autoFocus = false,
}: AISearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [interpretation, setInterpretation] = useState<SearchInterpretation | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('kcu_recent_searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved).slice(0, 5));
    }
  }, []);

  // Save search to recent
  const saveToRecent = useCallback((search: string) => {
    const updated = [search, ...recentSearches.filter((s) => s !== search)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('kcu_recent_searches', JSON.stringify(updated));
  }, [recentSearches]);

  // Perform semantic search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setInterpretation(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, scope }),
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setResults(data.results || []);
      setInterpretation(data.interpretation || null);
    } catch (error) {
      console.error('Search error:', error);
      // Fallback to mock results
      setResults(getMockResults(searchQuery, scope));
      setInterpretation({
        originalQuery: searchQuery,
        interpretation: `Searching for "${searchQuery}"`,
        intent: searchQuery.includes('?') ? 'question' : 'search',
        scope: [scope],
        suggestions: [`Try: "trades where I lost money"`, `Try: "explain patience candles"`],
      });
    } finally {
      setIsLoading(false);
    }
  }, [scope]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        performSearch(query);
      } else {
        setResults([]);
        setInterpretation(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = results.length + (interpretation?.intent === 'question' ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (interpretation?.intent === 'question' && selectedIndex === 0) {
            handleAskCoach();
          } else {
            const resultIndex = interpretation?.intent === 'question' ? selectedIndex - 1 : selectedIndex;
            if (results[resultIndex]) {
              handleResultClick(results[resultIndex]);
            }
          }
        } else if (interpretation?.intent === 'question') {
          handleAskCoach();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    saveToRecent(query);
    setIsOpen(false);
    setQuery('');

    if (onResultSelect) {
      onResultSelect(result);
    } else if (result.url) {
      router.push(result.url);
    }
  };

  const handleAskCoach = () => {
    saveToRecent(query);
    if (onAskCoach) {
      onAskCoach(query);
    }
    setIsOpen(false);
    setQuery('');
  };

  const handleRecentClick = (search: string) => {
    setQuery(search);
    performSearch(search);
  };

  const getResultIcon = (type: SearchResult['type']) => {
    const icons = {
      trade: BarChart3,
      lesson: BookOpen,
      video: Video,
      setup: Target,
      concept: FileText,
    };
    return icons[type] || FileText;
  };

  return (
    <div className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'w-full pl-10 pr-10 py-2.5',
            'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
            'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'focus:outline-none focus:border-[var(--accent-primary)]',
            'transition-colors'
          )}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent-primary)] animate-spin" />
        )}
      </div>

      {/* Results Dropdown */}
      <AnimatePresence>
        {isOpen && (query || recentSearches.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-xl max-h-[400px] overflow-y-auto"
          >
            {/* AI Interpretation */}
            {interpretation && (
              <div className="p-3 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                  <Sparkles className="w-3 h-3 text-[var(--accent-primary)]" />
                  <span>{interpretation.interpretation}</span>
                </div>
              </div>
            )}

            {/* Ask Coach Option (for questions) */}
            {interpretation?.intent === 'question' && (
              <button
                onClick={handleAskCoach}
                className={cn(
                  'w-full flex items-center gap-3 p-3 text-left',
                  'hover:bg-[var(--bg-tertiary)] transition-colors',
                  'border-b border-[var(--border-primary)]',
                  selectedIndex === 0 && 'bg-[var(--accent-primary-glow)]'
                )}
              >
                <div className="w-8 h-8 bg-[var(--accent-primary-glow)] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Ask your AI Coach</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Get a personalized answer to your question</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            )}

            {/* Search Results */}
            {results.length > 0 && (
              <div className="py-2">
                <p className="px-3 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Results
                </p>
                {results.map((result, index) => {
                  const Icon = getResultIcon(result.type);
                  const adjustedIndex = interpretation?.intent === 'question' ? index + 1 : index;

                  return (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left',
                        'hover:bg-[var(--bg-tertiary)] transition-colors',
                        selectedIndex === adjustedIndex && 'bg-[var(--accent-primary-glow)]'
                      )}
                    >
                      <div className="w-8 h-8 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center">
                        <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {result.title}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)] truncate">
                          {result.description}
                        </p>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] uppercase">
                        {result.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* No Results */}
            {query && !isLoading && results.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-sm text-[var(--text-tertiary)]">No results found</p>
                {interpretation?.suggestions && interpretation.suggestions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {interpretation.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => setQuery(suggestion.replace('Try: ', '').replace(/"/g, ''))}
                        className="block w-full text-xs text-[var(--accent-primary)] hover:underline"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recent Searches */}
            {!query && recentSearches.length > 0 && (
              <div className="py-2">
                <p className="px-3 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Recent Searches
                </p>
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleRecentClick(search)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <History className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-sm text-[var(--text-secondary)]">{search}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Keyboard Hint */}
            <div className="px-3 py-2 border-t border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--text-tertiary)]">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--text-tertiary)]">↵</kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--text-tertiary)]">esc</kbd>
                    close
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Command className="w-3 h-3" />K for command palette
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click Outside Handler */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================
// Mock Results (for development/fallback)
// ============================================

function getMockResults(query: string, scope: string): SearchResult[] {
  const lowerQuery = query.toLowerCase();

  const allResults: SearchResult[] = [
    // Trades
    { id: 't1', type: 'trade', title: 'AAPL Long +$245', description: 'Jan 15, 2024 - A-grade LTP setup', url: '/journal?trade=t1', relevance: 95 },
    { id: 't2', type: 'trade', title: 'SPY Short -$120', description: 'Jan 14, 2024 - Entered too early', url: '/journal?trade=t2', relevance: 85 },
    { id: 't3', type: 'trade', title: 'NVDA Long +$380', description: 'Jan 13, 2024 - Perfect patience candle', url: '/journal?trade=t3', relevance: 80 },

    // Lessons
    { id: 'l1', type: 'lesson', title: 'Understanding Patience Candles', description: 'LTP Framework Module - 12 min', url: '/learn/ltp-framework/patience-candles', relevance: 90 },
    { id: 'l2', type: 'lesson', title: 'Key Level Identification', description: 'LTP Framework Module - 15 min', url: '/learn/ltp-framework/key-levels', relevance: 85 },
    { id: 'l3', type: 'lesson', title: 'Trend Analysis Masterclass', description: 'Advanced Module - 20 min', url: '/learn/advanced/trend-analysis', relevance: 75 },

    // Videos
    { id: 'v1', type: 'video', title: 'Live Trading Session - LTP in Action', description: 'YouTube - 45 min', url: '/resources?video=v1', relevance: 70 },

    // Setups
    { id: 's1', type: 'setup', title: 'SPY Support Level Setup', description: 'Current - 85% confluence', url: '/companion?setup=s1', relevance: 88 },

    // Concepts
    { id: 'c1', type: 'concept', title: 'LTP Framework', description: 'Core trading methodology', url: '/learn/ltp-framework', relevance: 95 },
  ];

  // Filter by query relevance
  return allResults
    .filter((result) => {
      if (scope !== 'all' && result.type !== scope.slice(0, -1)) return false;
      return (
        result.title.toLowerCase().includes(lowerQuery) ||
        result.description.toLowerCase().includes(lowerQuery)
      );
    })
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 6);
}
