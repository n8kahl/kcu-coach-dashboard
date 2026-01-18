import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized clients to avoid build-time errors
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }
  return key;
}

// Client-side Supabase client (uses anon key) - lazy initialized
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_supabase) {
      _supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
    }
    return (_supabase as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Server-side Supabase client with admin privileges - lazy initialized
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      _supabaseAdmin = createClient(
        getSupabaseUrl(),
        serviceKey || getSupabaseAnonKey(),
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    }
    return (_supabaseAdmin as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Database types
export interface User {
  id: string;
  discord_id: string;
  email?: string;
  username: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
  subscription_tier: 'free' | 'pro' | 'elite';
  subscription_expires_at?: string;
  is_admin: boolean;
}

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price?: number;
  quantity: number;
  contract_type?: string;
  strike_price?: number;
  expiration_date?: string;
  entry_time: string;
  exit_time?: string;
  pnl?: number;
  pnl_percent?: number;
  setup_type?: string;
  notes?: string;
  emotions?: string[];
  mistakes?: string[];
  lessons?: string;
  screenshots?: string[];
  tags?: string[];
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  order_index: number;
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  module_id: string;
  progress_percent: number;
  completed_at?: string;
  quiz_scores?: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface CoachingSession {
  id: string;
  user_id: string;
  messages: ChatMessage[];
  context?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Companion Mode types
export interface Watchlist {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface WatchlistSymbol {
  id: string;
  watchlist_id: string;
  symbol: string;
  added_at: string;
  settings: Record<string, unknown>;
}

export interface SymbolLevel {
  id: string;
  symbol: string;
  level_type: string;
  price: number;
  timeframe: string;
  strength: number;
  created_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
}

export interface DetectedSetup {
  id: string;
  symbol: string;
  setup_type: string;
  direction: 'long' | 'short';
  confluence_score: number;
  level_score: number;
  trend_score: number;
  patience_score: number;
  order_flow_score: number;
  market_score: number;
  orb_score: number;
  key_levels: Record<string, number>;
  analysis: Record<string, unknown>;
  coach_notes: string;
  status: 'forming' | 'ready' | 'triggered' | 'invalidated' | 'expired';
  detected_at: string;
  triggered_at?: string;
  expires_at: string;
}

export interface AdminAlert {
  id: string;
  admin_id: string;
  symbol: string;
  direction: 'long' | 'short';
  alert_type: 'loading' | 'entering' | 'adding' | 'take_profit' | 'exiting' | 'stopped_out' | 'update';
  contract?: string;
  entry_price?: number;
  stop_loss?: number;
  targets?: number[];
  message: string;
  ltp_justification?: string;
  created_at: string;
  is_active: boolean;
}
