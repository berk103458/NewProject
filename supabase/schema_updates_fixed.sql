-- ============================================
-- GAMERMATCH SCHEMA UPDATES (FIXED)
-- Kredi Sistemi ve Admin Panel İçin
-- ============================================
-- Bu dosya trigger'ları önce drop edip sonra oluşturur
-- ============================================

-- Add credits and is_admin to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 1 CHECK (credits >= 0),
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Update existing users to have 1 credit
UPDATE public.profiles SET credits = 1 WHERE credits IS NULL OR credits = 0;

-- Create credits_transactions table for credit history
CREATE TABLE IF NOT EXISTS public.credits_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT CHECK (type IN ('earned', 'spent', 'admin_added', 'admin_removed')) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for credits transactions
CREATE INDEX IF NOT EXISTS idx_credits_transactions_user_id ON public.credits_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_created_at ON public.credits_transactions(created_at DESC);

-- Function: Deduct credit when user searches
CREATE OR REPLACE FUNCTION public.deduct_search_credit()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user has credits
    IF (SELECT credits FROM public.profiles WHERE id = NEW.user_id_1) < 1 THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;
    
    -- Deduct 1 credit
    UPDATE public.profiles
    SET credits = credits - 1
    WHERE id = NEW.user_id_1;
    
    -- Log transaction
    INSERT INTO public.credits_transactions (user_id, amount, type, description)
    VALUES (NEW.user_id_1, -1, 'spent', 'Swipe search');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (to avoid duplicate error)
DROP TRIGGER IF EXISTS on_match_created_deduct_credit ON public.matches;

-- Trigger: Deduct credit on match creation (swipe)
CREATE TRIGGER on_match_created_deduct_credit
    BEFORE INSERT ON public.matches
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION public.deduct_search_credit();

-- RLS Policies for credits_transactions
ALTER TABLE public.credits_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own credit transactions" ON public.credits_transactions;
DROP POLICY IF EXISTS "Admins can view all credit transactions" ON public.credits_transactions;

CREATE POLICY "Users can view own credit transactions"
    ON public.credits_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all credit transactions"
    ON public.credits_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

-- Function: Prevent admin-like usernames
CREATE OR REPLACE FUNCTION public.check_username_restrictions()
RETURNS TRIGGER AS $$
DECLARE
    restricted_words TEXT[] := ARRAY['admin', 'administrator', 'mod', 'moderator', 'root', 'system', 'support', 'help'];
    username_lower TEXT;
BEGIN
    username_lower := LOWER(NEW.username);
    
    -- Check if username contains restricted words
    IF EXISTS (
        SELECT 1 FROM unnest(restricted_words) AS word
        WHERE username_lower LIKE '%' || word || '%'
    ) THEN
        RAISE EXCEPTION 'Username contains restricted words';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if exists (to avoid duplicate error)
DROP TRIGGER IF EXISTS check_username_before_insert ON public.profiles;
DROP TRIGGER IF EXISTS check_username_before_update ON public.profiles;

-- Trigger: Check username on insert/update
CREATE TRIGGER check_username_before_insert
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_username_restrictions();

CREATE TRIGGER check_username_before_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    WHEN (OLD.username IS DISTINCT FROM NEW.username)
    EXECUTE FUNCTION public.check_username_restrictions();

-- ============================================
-- COMPLETED
-- ============================================

