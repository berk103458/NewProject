"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Username validation - admin, administrator, mod, moderator gibi kelimeleri engelle
    const restrictedWords = ["admin", "administrator", "mod", "moderator", "root", "system", "support", "help"];
    const usernameLower = username.toLowerCase().trim();
    
    if (restrictedWords.some(word => usernameLower.includes(word))) {
      setError("Bu kullanıcı adı kullanılamaz. Lütfen başka bir kullanıcı adı seç.");
      setLoading(false);
      return;
    }

    if (username.length < 3) {
      setError("Kullanıcı adı en az 3 karakter olmalı");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı");
      setLoading(false);
      return;
    }

    try {
      const result = await signUp(email, password, username);
      
      // Email confirmation required - redirect to verify page
      if (result?.user && !result.user.email_confirmed_at) {
        router.push("/auth/verify-email");
      } else if (result?.user) {
        // Email already confirmed (shouldn't happen but just in case)
        router.push("/onboarding");
      } else {
        setError("Kayıt başarılı! Email onayı için kontrol et.");
      }
    } catch (err: any) {
      setError(err.message || "Kayıt olunamadı");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-neon-purple/5">
      <Card className="w-full max-w-md border-2 border-neon-green/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Gamepad2 className="w-12 h-12 text-neon-green" />
          </div>
          <CardTitle className="text-3xl font-gaming">
            <span className="text-neon-purple">Gamer</span>
            <span className="text-neon-green">Match</span>
          </CardTitle>
          <CardDescription>Yeni hesap oluştur</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Kullanıcı Adı
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg bg-input border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-neon-green"
                placeholder="gamer123"
              />
            </div>
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
                className="w-full px-4 py-2 rounded-lg bg-input border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-neon-green"
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
                minLength={6}
                className="w-full px-4 py-2 rounded-lg bg-input border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-neon-green"
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground mt-1">En az 6 karakter</p>
            </div>
            <Button
              type="submit"
              variant="neonGreen"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kayıt olunuyor...
                </>
              ) : (
                "Kayıt Ol"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">Zaten hesabın var mı? </span>
            <Link href="/auth/login" className="text-neon-green hover:underline">
              Giriş yap
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

