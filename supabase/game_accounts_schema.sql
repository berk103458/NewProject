-- ============================================
-- OYUN HESAPLARI VE İSTATİSTİKLER SCHEMA
-- ============================================
-- LoL, Valorant, CS2 için hesap bağlama ve istatistikler
-- ============================================

-- Game Accounts Table (Kullanıcının bağladığı oyun hesapları)
CREATE TABLE IF NOT EXISTS public.game_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    game_username TEXT NOT NULL,
    game_tag TEXT, -- Valorant için tag (username#tag)
    region TEXT DEFAULT 'TR', -- LoL için region (TR, EUW, vs.)
    rank TEXT,
    tier TEXT, -- LoL için tier (Iron, Bronze, etc.)
    level INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    api_key TEXT, -- Riot API key (encrypted)
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, game_id)
);

-- Game Statistics Table (Oyun istatistikleri)
CREATE TABLE IF NOT EXISTS public.game_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_account_id UUID NOT NULL REFERENCES public.game_accounts(id) ON DELETE CASCADE,
    season TEXT, -- Sezon bilgisi
    total_games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    winrate DECIMAL(5, 2) DEFAULT 0.00,
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    total_assists INTEGER DEFAULT 0,
    kda DECIMAL(5, 2) DEFAULT 0.00,
    avg_farm INTEGER DEFAULT 0, -- LoL için CS
    avg_damage INTEGER DEFAULT 0,
    favorite_champion TEXT, -- LoL için
    favorite_agent TEXT, -- Valorant için
    last_match_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recent Matches Table (Son oynanan oyunlar)
CREATE TABLE IF NOT EXISTS public.recent_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_account_id UUID NOT NULL REFERENCES public.game_accounts(id) ON DELETE CASCADE,
    match_id TEXT, -- Riot API match ID
    game_mode TEXT, -- Ranked, Normal, etc.
    champion TEXT, -- LoL için
    agent TEXT, -- Valorant için
    role TEXT,
    result TEXT CHECK (result IN ('win', 'loss')) NOT NULL,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    farm INTEGER DEFAULT 0,
    damage INTEGER DEFAULT 0,
    match_duration INTEGER, -- Saniye cinsinden
    match_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match Teammates Table (Son oynadığı kişiler)
CREATE TABLE IF NOT EXISTS public.match_teammates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.recent_matches(id) ON DELETE CASCADE,
    teammate_username TEXT NOT NULL,
    teammate_tag TEXT,
    was_ally BOOLEAN DEFAULT TRUE, -- Takım arkadaşı mı yoksa rakip mi
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_accounts_user_id ON public.game_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_game_accounts_game_id ON public.game_accounts(game_id);
CREATE INDEX IF NOT EXISTS idx_game_statistics_game_account_id ON public.game_statistics(game_account_id);
CREATE INDEX IF NOT EXISTS idx_recent_matches_game_account_id ON public.recent_matches(game_account_id);
CREATE INDEX IF NOT EXISTS idx_recent_matches_match_date ON public.recent_matches(match_date DESC);
CREATE INDEX IF NOT EXISTS idx_match_teammates_match_id ON public.match_teammates(match_id);

-- Function: Update winrate automatically
CREATE OR REPLACE FUNCTION public.update_winrate()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.game_statistics
    SET 
        winrate = CASE 
            WHEN total_games > 0 THEN (wins::DECIMAL / total_games::DECIMAL * 100)
            ELSE 0
        END,
        kda = CASE
            WHEN total_deaths > 0 THEN ((total_kills + total_assists)::DECIMAL / total_deaths::DECIMAL)
            ELSE (total_kills + total_assists)::DECIMAL
        END,
        updated_at = NOW()
    WHERE game_account_id = NEW.game_account_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update winrate
DROP TRIGGER IF EXISTS on_game_statistics_update_winrate ON public.game_statistics;
CREATE TRIGGER on_game_statistics_update_winrate
    AFTER INSERT OR UPDATE ON public.game_statistics
    FOR EACH ROW
    EXECUTE FUNCTION public.update_winrate();

-- Trigger: Auto-update updated_at
CREATE TRIGGER set_updated_at_game_accounts
    BEFORE UPDATE ON public.game_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_game_statistics
    BEFORE UPDATE ON public.game_statistics
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies
ALTER TABLE public.game_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_teammates ENABLE ROW LEVEL SECURITY;

-- Game Accounts Policies
CREATE POLICY "Users can view all game accounts"
    ON public.game_accounts FOR SELECT
    USING (true);

CREATE POLICY "Users can manage own game accounts"
    ON public.game_accounts FOR ALL
    USING (auth.uid() = user_id);

-- Game Statistics Policies
CREATE POLICY "Game statistics are viewable by everyone"
    ON public.game_statistics FOR SELECT
    USING (true);

CREATE POLICY "Users can manage own game statistics"
    ON public.game_statistics FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.game_accounts
            WHERE game_accounts.id = game_statistics.game_account_id
            AND game_accounts.user_id = auth.uid()
        )
    );

-- Recent Matches Policies
CREATE POLICY "Recent matches are viewable by everyone"
    ON public.recent_matches FOR SELECT
    USING (true);

CREATE POLICY "Users can manage own recent matches"
    ON public.recent_matches FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.game_accounts
            WHERE game_accounts.id = recent_matches.game_account_id
            AND game_accounts.user_id = auth.uid()
        )
    );

-- Match Teammates Policies
CREATE POLICY "Match teammates are viewable by everyone"
    ON public.match_teammates FOR SELECT
    USING (true);

-- ============================================
-- COMPLETED
-- ============================================

