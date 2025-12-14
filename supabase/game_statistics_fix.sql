-- ============================================
-- GAME STATISTICS FIX
-- Unique constraint ekle ve frontend'i düzelt
-- ============================================

-- Add unique constraint for game_statistics
ALTER TABLE public.game_statistics
DROP CONSTRAINT IF EXISTS game_statistics_game_account_id_season_key;

ALTER TABLE public.game_statistics
ADD CONSTRAINT game_statistics_game_account_id_season_key UNIQUE (game_account_id, season);

-- ============================================
-- COMPLETED
-- ============================================





