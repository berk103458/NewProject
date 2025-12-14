-- ============================================
-- FIX RECURSIVE TRIGGER PROBLEM
-- game_statistics trigger'ı recursive update yapıyor
-- Trigger'ı kaldırıp winrate ve kda'yı direkt hesaplıyoruz
-- ============================================

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS on_game_statistics_update_winrate ON public.game_statistics;

-- Drop the function (artık gerekli değil, winrate ve kda zaten API'de hesaplanıyor)
DROP FUNCTION IF EXISTS public.update_winrate();

-- ============================================
-- COMPLETED
-- ============================================
-- Not: Winrate ve KDA artık API route'da hesaplanıyor
-- ve direkt upsert ediliyor, trigger'a gerek yok
-- ============================================





