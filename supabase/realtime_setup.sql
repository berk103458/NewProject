-- ============================================
-- REALTIME SETUP FOR MESSAGES TABLE
-- ============================================
-- Bu SQL'i Supabase SQL Editor'de çalıştır
-- Chat'in realtime çalışması için gerekli
-- ============================================

-- Realtime'ı messages tablosu için aktif et
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Doğrulama: Realtime aktif mi kontrol et
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages';

-- Eğer hata alırsan (zaten ekliyse), şunu dene:
-- ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS messages;

-- ============================================
-- COMPLETED
-- ============================================

