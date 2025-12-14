-- ============================================
-- GAME ACCOUNTS MIGRATION
-- platform_id ve lp kolonlarını ekle
-- ============================================

-- Add platform_id column (Riot PUUID)
ALTER TABLE public.game_accounts
ADD COLUMN IF NOT EXISTS platform_id TEXT;

-- Add lp column (League Points for LoL)
ALTER TABLE public.game_accounts
ADD COLUMN IF NOT EXISTS lp INTEGER;

-- Create index for platform_id
CREATE INDEX IF NOT EXISTS idx_game_accounts_platform_id ON public.game_accounts(platform_id);

-- ============================================
-- COMPLETED
-- ============================================





