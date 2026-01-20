-- ============================================================================
-- User Trading Profiles Migration
-- The "Elephant's Memory" - AI knows WHO it is coaching
--
-- Stores user trading weaknesses, preferences, and behavioral patterns
-- for proactive intervention and personalized coaching.
-- ============================================================================

-- Create enum for trading weaknesses
DO $$ BEGIN
    CREATE TYPE trading_weakness AS ENUM (
        'chasing_entries',      -- Entering too late, FOMO
        'no_stop_loss',         -- Failing to set/honor stops
        'trend_fighting',       -- Going against the trend
        'overtrading',          -- Too many trades per day
        'revenge_trading',      -- Trading after losses
        'early_profit_taking',  -- Taking profits too soon
        'moving_stops',         -- Moving stops to "give room"
        'size_too_big',         -- Position sizing issues
        'averaging_down',       -- Adding to losers
        'not_waiting',          -- Not waiting for patience candle
        'level_ignoring',       -- Not trading at levels
        'fomo_buying',          -- Fear of missing out
        'fear_selling',         -- Panic selling at lows
        'holding_losers',       -- Not cutting losses
        'lack_of_plan'          -- No entry/exit plan
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for favorite setup types
DO $$ BEGIN
    CREATE TYPE setup_type AS ENUM (
        'breakout',
        'breakdown',
        'bounce_support',
        'rejection_resistance',
        'trend_continuation',
        'reversal',
        'gap_fill',
        'orb_breakout',
        'vwap_bounce',
        'ema_crossover',
        'fvg_fill',
        'structure_break'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for risk tolerance
DO $$ BEGIN
    CREATE TYPE risk_tolerance_level AS ENUM (
        'conservative',    -- 0.5% risk per trade
        'moderate',        -- 1% risk per trade
        'aggressive',      -- 2% risk per trade
        'very_aggressive'  -- 2%+ risk per trade
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create the user_trading_profiles table
CREATE TABLE IF NOT EXISTS user_trading_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Trading Weaknesses (AI will watch for these)
    weaknesses trading_weakness[] DEFAULT ARRAY[]::trading_weakness[],
    weakness_severity JSONB DEFAULT '{}'::jsonb,  -- Maps weakness to severity (1-10)

    -- Favorite Setups (what they trade best)
    favorite_setups setup_type[] DEFAULT ARRAY[]::setup_type[],
    setup_win_rates JSONB DEFAULT '{}'::jsonb,  -- Maps setup to historical win rate

    -- Risk Profile
    risk_tolerance risk_tolerance_level DEFAULT 'moderate',
    max_daily_trades INTEGER DEFAULT 3,
    max_daily_loss_percent DECIMAL(5,2) DEFAULT 3.0,
    preferred_position_size_percent DECIMAL(5,2) DEFAULT 1.0,

    -- Mental Capital Score (0-100)
    -- Tracks emotional state and trading readiness
    mental_capital INTEGER DEFAULT 100 CHECK (mental_capital >= 0 AND mental_capital <= 100),
    mental_capital_updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Recent Performance Patterns (updated by AI analysis)
    recent_win_rate DECIMAL(5,2),
    recent_avg_ltp_score DECIMAL(5,2),
    consecutive_losses INTEGER DEFAULT 0,
    consecutive_wins INTEGER DEFAULT 0,

    -- Trading Session Preferences
    preferred_market_session TEXT[] DEFAULT ARRAY['open', 'power_hour']::TEXT[],
    avoid_around_events BOOLEAN DEFAULT true,

    -- Coaching Preferences
    coaching_intensity TEXT DEFAULT 'normal' CHECK (coaching_intensity IN ('light', 'normal', 'intense')),
    allow_blocking_warnings BOOLEAN DEFAULT true,  -- Can AI block trades?
    notification_preferences JSONB DEFAULT '{"breadth_warnings": true, "event_warnings": true, "pattern_warnings": true}'::jsonb,

    -- Behavioral Patterns (detected by AI)
    detected_patterns JSONB DEFAULT '{}'::jsonb,
    -- Example: {"chasing_peak_hours": "10:00-11:00", "revenge_after_loss": true, "overtrades_on_green_days": true}

    -- Custom Notes/Reminders
    coach_notes TEXT[],  -- Somesh-style reminders
    personal_rules TEXT[],  -- User's own trading rules

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trading_profiles_user ON user_trading_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_profiles_mental_capital ON user_trading_profiles(mental_capital);
CREATE INDEX IF NOT EXISTS idx_trading_profiles_weaknesses ON user_trading_profiles USING GIN(weaknesses);

-- Enable RLS
ALTER TABLE user_trading_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own trading profile"
    ON user_trading_profiles
    FOR SELECT
    USING (auth.uid()::text = user_id::text OR EXISTS (
        SELECT 1 FROM user_profiles WHERE id = auth.uid()::uuid AND is_admin = true
    ));

CREATE POLICY "Users can update own trading profile"
    ON user_trading_profiles
    FOR UPDATE
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own trading profile"
    ON user_trading_profiles
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_trading_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_trading_profile_timestamp ON user_trading_profiles;
CREATE TRIGGER update_trading_profile_timestamp
    BEFORE UPDATE ON user_trading_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_trading_profile_timestamp();

-- ============================================================================
-- Helper Functions for Coaching
-- ============================================================================

-- Function to update mental capital after a trade
CREATE OR REPLACE FUNCTION update_mental_capital(
    p_user_id UUID,
    p_trade_result TEXT,  -- 'win', 'loss', 'breakeven'
    p_ltp_score INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_current_capital INTEGER;
    v_new_capital INTEGER;
    v_consecutive_losses INTEGER;
BEGIN
    -- Get current values
    SELECT mental_capital, consecutive_losses INTO v_current_capital, v_consecutive_losses
    FROM user_trading_profiles
    WHERE user_id = p_user_id;

    IF v_current_capital IS NULL THEN
        v_current_capital := 100;
        v_consecutive_losses := 0;
    END IF;

    -- Calculate new mental capital
    CASE p_trade_result
        WHEN 'win' THEN
            -- Wins restore mental capital, especially good LTP trades
            IF p_ltp_score IS NOT NULL AND p_ltp_score >= 80 THEN
                v_new_capital := LEAST(100, v_current_capital + 10);  -- A+ trade win
            ELSE
                v_new_capital := LEAST(100, v_current_capital + 5);
            END IF;
            v_consecutive_losses := 0;
        WHEN 'loss' THEN
            v_consecutive_losses := v_consecutive_losses + 1;
            -- Losses reduce mental capital, more for consecutive losses
            v_new_capital := GREATEST(0, v_current_capital - (5 * v_consecutive_losses));
        ELSE
            v_new_capital := v_current_capital;  -- Breakeven
    END CASE;

    -- Update profile
    UPDATE user_trading_profiles
    SET
        mental_capital = v_new_capital,
        mental_capital_updated_at = NOW(),
        consecutive_losses = v_consecutive_losses,
        consecutive_wins = CASE WHEN p_trade_result = 'win' THEN consecutive_wins + 1 ELSE 0 END
    WHERE user_id = p_user_id;

    RETURN v_new_capital;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user should be warned based on mental capital
CREATE OR REPLACE FUNCTION should_warn_mental_capital(p_user_id UUID)
RETURNS TABLE (
    should_warn BOOLEAN,
    warning_level TEXT,
    message TEXT
) AS $$
DECLARE
    v_capital INTEGER;
    v_consecutive_losses INTEGER;
BEGIN
    SELECT mental_capital, consecutive_losses INTO v_capital, v_consecutive_losses
    FROM user_trading_profiles
    WHERE user_id = p_user_id;

    IF v_capital IS NULL THEN
        RETURN QUERY SELECT false, 'none'::TEXT, ''::TEXT;
        RETURN;
    END IF;

    -- Check conditions
    IF v_capital <= 20 THEN
        RETURN QUERY SELECT true, 'critical'::TEXT,
            'Your mental capital is DEPLETED. Step away from the screen. Tomorrow is another day.'::TEXT;
    ELSIF v_capital <= 40 THEN
        RETURN QUERY SELECT true, 'warning'::TEXT,
            'Mental capital running low. Take a break. One more loss and you should be done for the day.'::TEXT;
    ELSIF v_consecutive_losses >= 3 THEN
        RETURN QUERY SELECT true, 'warning'::TEXT,
            '3 losses in a row. The market has your number today. Step away before revenge trading kicks in.'::TEXT;
    ELSIF v_capital <= 60 THEN
        RETURN QUERY SELECT true, 'info'::TEXT,
            'Mental capital below 60%. Trade smaller if you trade at all.'::TEXT;
    ELSE
        RETURN QUERY SELECT false, 'none'::TEXT, ''::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to add a weakness to user profile
CREATE OR REPLACE FUNCTION add_user_weakness(
    p_user_id UUID,
    p_weakness trading_weakness,
    p_severity INTEGER DEFAULT 5
)
RETURNS VOID AS $$
BEGIN
    -- Insert or update profile
    INSERT INTO user_trading_profiles (user_id, weaknesses, weakness_severity)
    VALUES (
        p_user_id,
        ARRAY[p_weakness],
        jsonb_build_object(p_weakness::text, p_severity)
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        weaknesses = CASE
            WHEN NOT (p_weakness = ANY(user_trading_profiles.weaknesses))
            THEN array_append(user_trading_profiles.weaknesses, p_weakness)
            ELSE user_trading_profiles.weaknesses
        END,
        weakness_severity = user_trading_profiles.weakness_severity || jsonb_build_object(p_weakness::text, p_severity);
END;
$$ LANGUAGE plpgsql;

-- Function to get coaching context for a user
CREATE OR REPLACE FUNCTION get_coaching_context(p_user_id UUID)
RETURNS TABLE (
    weaknesses trading_weakness[],
    mental_capital INTEGER,
    risk_tolerance risk_tolerance_level,
    consecutive_losses INTEGER,
    coaching_intensity TEXT,
    allow_blocking BOOLEAN,
    should_trade BOOLEAN,
    warning_message TEXT
) AS $$
DECLARE
    v_profile RECORD;
    v_warning RECORD;
BEGIN
    SELECT * INTO v_profile FROM user_trading_profiles WHERE user_id = p_user_id;
    SELECT * INTO v_warning FROM should_warn_mental_capital(p_user_id);

    IF v_profile IS NULL THEN
        -- Return defaults for users without a profile
        RETURN QUERY SELECT
            ARRAY[]::trading_weakness[],
            100,
            'moderate'::risk_tolerance_level,
            0,
            'normal'::TEXT,
            true,
            true,
            ''::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        v_profile.weaknesses,
        v_profile.mental_capital,
        v_profile.risk_tolerance,
        v_profile.consecutive_losses,
        v_profile.coaching_intensity,
        v_profile.allow_blocking_warnings,
        NOT v_warning.should_warn OR v_warning.warning_level != 'critical',
        COALESCE(v_warning.message, '');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Default Profile Creation Trigger
-- ============================================================================

-- Automatically create a trading profile when a user is created
CREATE OR REPLACE FUNCTION create_default_trading_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_trading_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_trading_profile_on_user ON user_profiles;
CREATE TRIGGER create_trading_profile_on_user
    AFTER INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_trading_profile();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON user_trading_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION update_mental_capital TO authenticated;
GRANT EXECUTE ON FUNCTION should_warn_mental_capital TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_weakness TO authenticated;
GRANT EXECUTE ON FUNCTION get_coaching_context TO authenticated;

COMMENT ON TABLE user_trading_profiles IS 'User trading profiles for proactive AI coaching - the "Elephant''s Memory"';
COMMENT ON COLUMN user_trading_profiles.weaknesses IS 'Array of trading weaknesses the AI should watch for';
COMMENT ON COLUMN user_trading_profiles.mental_capital IS 'Emotional/mental trading capital score (0-100)';
COMMENT ON COLUMN user_trading_profiles.allow_blocking_warnings IS 'Whether the AI can block trades with critical warnings';
