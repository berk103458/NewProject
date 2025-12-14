-- ============================================
-- GAMERMATCH SCHEMA UPDATES
-- Kredi Sistemi ve Admin Panel İçin
-- ============================================

-- Add credits and is_admin to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 5 CHECK (credits >= 0),
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Update existing users to have at least 5 credits
UPDATE public.profiles SET credits = 5 WHERE credits IS NULL OR credits < 5;

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

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_match_created_deduct_credit ON public.matches;

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

-- Drop triggers if exists
DROP TRIGGER IF EXISTS check_username_before_insert ON public.profiles;
DROP TRIGGER IF EXISTS check_username_before_update ON public.profiles;

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

-- Add last_seen for online status tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

UPDATE public.profiles SET last_seen = NOW() WHERE last_seen IS NULL;

-- Messages: support media
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS message_type TEXT CHECK (message_type IN ('text','image','video')) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_meta JSONB;

-- Call permissions per match & user (mutual opt-in)
CREATE TABLE IF NOT EXISTS public.match_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    allow_voice BOOLEAN DEFAULT FALSE,
    allow_video BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_permissions_match_id ON public.match_permissions(match_id);
CREATE INDEX IF NOT EXISTS idx_match_permissions_user_id ON public.match_permissions(user_id);

-- Call requests (mutual confirmation for voice/video)
CREATE TABLE IF NOT EXISTS public.call_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('voice','video')) NOT NULL,
    status TEXT CHECK (status IN ('pending','accepted','rejected','expired')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Normalize to one row per (match_id, requester_id)
DO $$
BEGIN
  ALTER TABLE public.call_requests DROP CONSTRAINT IF EXISTS call_requests_match_id_requester_id_status_key;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE public.call_requests
  ADD CONSTRAINT call_requests_match_id_requester_id_key UNIQUE (match_id, requester_id);

-- RLS for call_requests
ALTER TABLE public.call_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_requests_select_participants" ON public.call_requests;
DROP POLICY IF EXISTS "call_requests_write_requester" ON public.call_requests;
DROP POLICY IF EXISTS "call_requests_insert_requester" ON public.call_requests;
DROP POLICY IF EXISTS "call_requests_update_requester" ON public.call_requests;

-- Only match participants can read
CREATE POLICY "call_requests_select_participants"
  ON public.call_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  );

-- Requester can insert own requests (admin client bypasses RLS anyway)
CREATE POLICY "call_requests_insert_requester"
  ON public.call_requests
  FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  );

-- Requester can update own requests
CREATE POLICY "call_requests_update_requester"
  ON public.call_requests
  FOR UPDATE
  USING (
    requester_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  )
  WITH CHECK (
    requester_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_call_requests_match_id ON public.call_requests(match_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_status ON public.call_requests(status);

-- RLS for match_permissions
ALTER TABLE public.match_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own match permissions" ON public.match_permissions;
DROP POLICY IF EXISTS "Users can upsert own match permissions" ON public.match_permissions;
DROP POLICY IF EXISTS "Users can insert match permissions" ON public.match_permissions;
DROP POLICY IF EXISTS "Users can update match permissions" ON public.match_permissions;

CREATE POLICY "Users can read own match permissions"
  ON public.match_permissions
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  );

CREATE POLICY "Users can insert match permissions"
  ON public.match_permissions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  );

CREATE POLICY "Users can update match permissions"
  ON public.match_permissions
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  );

-- Helper function for upsert to bypass composite upsert limitation with RLS
CREATE OR REPLACE FUNCTION public.upsert_match_permission(
  p_match_id UUID,
  p_user_id UUID,
  p_allow_voice BOOLEAN,
  p_allow_video BOOLEAN
) RETURNS public.match_permissions AS $$
DECLARE
  result public.match_permissions;
BEGIN
  INSERT INTO public.match_permissions (match_id, user_id, allow_voice, allow_video)
  VALUES (p_match_id, p_user_id, p_allow_voice, p_allow_video)
  ON CONFLICT (match_id, user_id)
  DO UPDATE SET allow_voice = EXCLUDED.allow_voice, allow_video = EXCLUDED.allow_video
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Call blocks (prevent repeated requests after reject)
CREATE TABLE IF NOT EXISTS public.call_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, blocked_user_id)
);

ALTER TABLE public.call_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read call blocks in match" ON public.call_blocks;
DROP POLICY IF EXISTS "Manage own call blocks" ON public.call_blocks;
DROP POLICY IF EXISTS "Insert/Update call blocks" ON public.call_blocks;
DROP POLICY IF EXISTS "Insert call blocks" ON public.call_blocks;
DROP POLICY IF EXISTS "Update call blocks" ON public.call_blocks;
DROP POLICY IF EXISTS "Delete call blocks" ON public.call_blocks;

CREATE POLICY "Read call blocks in match"
  ON public.call_blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  );

CREATE POLICY "Insert call blocks"
  ON public.call_blocks
  FOR INSERT
  WITH CHECK (
    blocker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  );

CREATE POLICY "Update call blocks"
  ON public.call_blocks
  FOR UPDATE
  USING (
    blocker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  )
  WITH CHECK (
    blocker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  );

CREATE POLICY "Delete call blocks"
  ON public.call_blocks
  FOR DELETE
  USING (
    blocker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user_id_1 = auth.uid() OR m.user_id_2 = auth.uid())
    )
  );

-- ============================================
-- COMPLETED
-- ============================================

