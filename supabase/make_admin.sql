-- ============================================
-- KULLANICIYI ADMIN YAPMA
-- ============================================
-- Bu SQL'i Supabase SQL Editor'de çalıştır
-- EMAIL_ADRESI yerine admin yapmak istediğin kullanıcının email'ini yaz
-- ============================================

-- Kullanıcıyı admin yap
UPDATE public.profiles
SET is_admin = TRUE
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'EMAIL_ADRESI'
);

-- Doğrulama
SELECT 
    p.username,
    p.is_admin,
    u.email
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'EMAIL_ADRESI';

-- ============================================
-- TÜM KULLANICILARA 1 KREDİ VER
-- ============================================

UPDATE public.profiles
SET credits = 1
WHERE credits IS NULL OR credits = 0;

-- ============================================
-- COMPLETED
-- ============================================

