/**
 * Supabase Admin Client
 * 
 * NOT: Bu dosya service role key ile çalışır
 * Service role key'i .env.local'e ekle:
 * SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 * 
 * ⚠️ Service role key'i ASLA client-side'da kullanma!
 * Sadece server-side (API routes) kullan!
 */

import { createClient } from "@supabase/supabase-js";

export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

