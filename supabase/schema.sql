-- ============================================
-- GAMERMATCH DATABASE SCHEMA
-- ============================================
-- Bu dosyayı Supabase SQL Editor'de çalıştırın
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    discord_id TEXT,
    bio TEXT,
    avatar_url TEXT,
    riot_id TEXT,
    personality_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    play_style TEXT CHECK (play_style IN ('Competitive', 'Casual')) DEFAULT 'Casual',
    toxicity_score INTEGER DEFAULT 0 CHECK (toxicity_score >= 0 AND toxicity_score <= 100),
    user_points INTEGER DEFAULT 0 CHECK (user_points >= 0),
    wallet_balance DECIMAL(10, 2) DEFAULT 0.00 CHECK (wallet_balance >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games Table
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    rank_system JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Game Profiles (Kullanıcının hangi oyunlarda hangi rank'te olduğu)
CREATE TABLE IF NOT EXISTS public.user_game_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    rank TEXT,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, game_id)
);

-- Matches Table
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'matched', 'rejected')) DEFAULT 'pending',
    game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (user_id_1 != user_id_2),
    UNIQUE(user_id_1, user_id_2)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports Table (Toxicity tracking için)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT,
    match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (reporter_id != reported_id)
);

-- Game Sessions Table (Eşleşenlerin birlikte oynadığı oyunlar)
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    session_date TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (Performance Optimization)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_personality_tags ON public.profiles USING GIN(personality_tags);
CREATE INDEX IF NOT EXISTS idx_profiles_play_style ON public.profiles(play_style);
CREATE INDEX IF NOT EXISTS idx_profiles_toxicity_score ON public.profiles(toxicity_score);

CREATE INDEX IF NOT EXISTS idx_user_game_profiles_user_id ON public.user_game_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_game_profiles_game_id ON public.user_game_profiles(game_id);

CREATE INDEX IF NOT EXISTS idx_matches_user_id_1 ON public.matches(user_id_1);
CREATE INDEX IF NOT EXISTS idx_matches_user_id_2 ON public.matches(user_id_2);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_game_id ON public.matches(game_id);

CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_reported_id ON public.reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_match_id ON public.game_sessions(match_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at for profiles
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: Auto-update updated_at for user_game_profiles
CREATE TRIGGER set_updated_at_user_game_profiles
    BEFORE UPDATE ON public.user_game_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: Auto-update updated_at for matches
CREATE TRIGGER set_updated_at_matches
    BEFORE UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Function: Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Create profile when user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function: Update toxicity_score based on reports
CREATE OR REPLACE FUNCTION public.update_toxicity_score()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET toxicity_score = LEAST(100, toxicity_score + 5)
    WHERE id = NEW.reported_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Increase toxicity score on report
CREATE TRIGGER on_report_created
    AFTER INSERT ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_toxicity_score();

-- Function: Award points when match is confirmed
CREATE OR REPLACE FUNCTION public.award_match_points()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'matched' AND OLD.status != 'matched' THEN
        UPDATE public.profiles
        SET user_points = user_points + 10
        WHERE id IN (NEW.user_id_1, NEW.user_id_2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Award points on match
CREATE TRIGGER on_match_matched
    AFTER UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION public.award_match_points();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_game_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Games Policies
CREATE POLICY "Games are viewable by everyone"
    ON public.games FOR SELECT
    USING (true);

-- User Game Profiles Policies
CREATE POLICY "User game profiles are viewable by everyone"
    ON public.user_game_profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can manage own game profiles"
    ON public.user_game_profiles FOR ALL
    USING (auth.uid() = user_id);

-- Matches Policies
CREATE POLICY "Users can view their own matches"
    ON public.matches FOR SELECT
    USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users can create matches"
    ON public.matches FOR INSERT
    WITH CHECK (auth.uid() = user_id_1);

CREATE POLICY "Users can update their own matches"
    ON public.matches FOR UPDATE
    USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Messages Policies
CREATE POLICY "Users can view messages in their matches"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE matches.id = messages.match_id
            AND (matches.user_id_1 = auth.uid() OR matches.user_id_2 = auth.uid())
        )
    );

CREATE POLICY "Users can send messages in their matches"
    ON public.messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.matches
            WHERE matches.id = messages.match_id
            AND (matches.user_id_1 = auth.uid() OR matches.user_id_2 = auth.uid())
            AND matches.status = 'matched'
        )
    );

-- Reports Policies
CREATE POLICY "Users can create reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports"
    ON public.reports FOR SELECT
    USING (auth.uid() = reporter_id);

-- Game Sessions Policies
CREATE POLICY "Users can view game sessions in their matches"
    ON public.game_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE matches.id = game_sessions.match_id
            AND (matches.user_id_1 = auth.uid() OR matches.user_id_2 = auth.uid())
        )
    );

CREATE POLICY "Users can create game sessions in their matches"
    ON public.game_sessions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE matches.id = game_sessions.match_id
            AND (matches.user_id_1 = auth.uid() OR matches.user_id_2 = auth.uid())
            AND matches.status = 'matched'
        )
    );

-- ============================================
-- SEED DATA (Initial Games)
-- ============================================

INSERT INTO public.games (name, slug, rank_system) VALUES
    ('League of Legends', 'lol', '{"ranks": ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Challenger"]}'::JSONB),
    ('Valorant', 'valorant', '{"ranks": ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"]}'::JSONB),
    ('Counter-Strike 2', 'cs2', '{"ranks": ["Silver I", "Silver II", "Silver Elite", "Gold Nova I", "Gold Nova Master", "Master Guardian I", "Master Guardian Elite", "Distinguished Master Guardian", "Legendary Eagle", "Legendary Eagle Master", "Supreme Master First Class", "Global Elite"]}'::JSONB)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- COMPLETED
-- ============================================

