import { createBrowserClient } from "@supabase/ssr";

// Singleton pattern - cache the client instance
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export const createSupabaseClient = () => {
  // Return cached instance if available
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Create new instance only once
  supabaseInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return supabaseInstance;
};

// Export singleton instance
export const supabase = createSupabaseClient();

