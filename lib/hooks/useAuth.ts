"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/useAuthStore";

export function useAuth() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const { user, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);

        // Touch last_seen for online status
        if (session?.user) {
          try {
            await supabase
              .from("profiles")
              .update({ last_seen: new Date().toISOString() })
              .eq("id", session.user.id);
          } catch (error) {
            // non-blocking
            console.warn("last_seen update failed", error);
          }
        }
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            await supabase
              .from("profiles")
              .update({ last_seen: new Date().toISOString() })
              .eq("id", session.user.id);
          } catch (error) {
            console.warn("last_seen update failed", error);
          }
        }
      }
    });

    return () => {
      mounted = false;
      try {
        subscription.unsubscribe();
      } catch (error) {
        // Subscription already unsubscribed
        console.error("Error unsubscribing:", error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return {
    user,
    signIn,
    signUp,
    signOut,
  };
}

