"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Loader2 } from "lucide-react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createSupabaseClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const authData = await signIn(email, password);
      
      if (authData?.user) {
        // Optimized: Single query with LEFT JOIN instead of 2 separate queries
        // This reduces database round trips from 2 to 1
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select(`
            personality_tags,
            play_style,
            user_game_profiles(id)
          `)
          .eq("id", authData.user.id)
          .maybeSingle();

        // If no profile found or error, user needs onboarding
        if (profileError || !profile) {
          router.push("/onboarding");
          return;
        }

        const hasGameProfile = (profile?.user_game_profiles?.length || 0) > 0;
        const hasAnsweredQuestions =
          (profile?.personality_tags?.length || 0) > 0 && !!profile?.play_style;

        // Fast redirect - no need to wait for loading state
        router.push(hasGameProfile || hasAnsweredQuestions ? "/swipe" : "/onboarding");
      }
    } catch (err: any) {
      setError(err.message || "Giriş yapılamadı");
      setLoading(false);
    }
    // Note: Don't set loading to false on success - let navigation handle it
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-neon-purple/5">
      <Card className="w-full max-w-md border-2 border-neon-purple/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Gamepad2 className="w-12 h-12 text-neon-purple" />
          </div>
          <CardTitle className="text-3xl font-gaming">
            <span className="text-neon-purple">Gamer</span>
            <span className="text-neon-green">Match</span>
          </CardTitle>
          <CardDescription>Hesabına giriş yap</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg bg-input border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-neon-purple"
                placeholder="ornek@email.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg bg-input border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-neon-purple"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              variant="neon"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Giriş yapılıyor...
                </>
              ) : (
                "Giriş Yap"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">Hesabın yok mu? </span>
            <Link href="/auth/signup" className="text-neon-purple hover:underline">
              Kayıt ol
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

