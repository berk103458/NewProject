-- ============================================
-- DEFAULT KREDİYİ 5'E ÇIKARMA MIGRATION
-- ============================================
-- Bu migration'ı Supabase SQL Editor'de çalıştır
-- Yeni kullanıcılar 5 kredi ile başlayacak
-- Mevcut kullanıcıların kredileri 5'ten azsa 5'e çıkarılacak
-- ============================================

-- 1. Default değeri 5'e güncelle
ALTER TABLE public.profiles 
ALTER COLUMN credits SET DEFAULT 5;

-- 2. handle_new_user() fonksiyonunu güncelle (yeni kullanıcılar için)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, credits)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
        5
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Mevcut kullanıcıların kredilerini 5'e çıkar (eğer 5'ten azsa)
UPDATE public.profiles 
SET credits = 5 
WHERE credits IS NULL OR credits < 5;

-- ============================================
-- COMPLETED
-- ============================================
-- Artık:
-- - Yeni kayıt olan kullanıcılar 5 kredi ile başlayacak
-- - Mevcut kullanıcıların kredileri 5'ten azsa 5'e çıkarıldı
-- ============================================

