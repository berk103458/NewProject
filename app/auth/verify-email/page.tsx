"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createSupabaseClient();
  const { user, loading: authLoading } = useAuthStore();

  useEffect(() => {
    // Check if email is already confirmed
    const checkEmailStatus = async () => {
      if (authLoading) return; // Wait for auth to load
      if (!user) {
        router.push("/auth/login");
        return;
      }

      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (currentUser?.email_confirmed_at) {
          // Check if user has completed onboarding
          const { data: gameProfile } = await supabase
            .from("user_game_profiles")
            .select("id")
            .eq("user_id", currentUser.id)
            .single();

          // If onboarding is completed, go to swipe, otherwise go to onboarding
          if (gameProfile) {
            router.push("/swipe");
          } else {
            router.push("/onboarding");
          }
        }
      } catch (error) {
        console.error("Error checking email status:", error);
      }
    };

    checkEmailStatus();
  }, [user, authLoading, router, supabase]);

  const resendConfirmationEmail = async () => {
    if (!user?.email) return;

    setResending(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });

      if (error) throw error;

      setMessage("Onay emaili tekrar gönderildi! Email kutunu kontrol et.");
    } catch (error: any) {
      setMessage(error.message || "Email gönderilemedi. Lütfen tekrar dene.");
    } finally {
      setResending(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-neon-purple/5">
      <Card className="w-full max-w-md border-2 border-neon-purple/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="w-16 h-16 text-neon-purple" />
          </div>
          <CardTitle className="text-2xl font-gaming">
            <span className="text-neon-purple">Email Onayı Gerekli</span>
          </CardTitle>
          <CardDescription>
            Hesabını aktifleştirmek için email onayı yapman gerekiyor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              <strong className="text-foreground">{user.email}</strong> adresine onay emaili gönderildi.
            </p>
            <p className="text-xs text-muted-foreground">
              Email kutunu kontrol et ve onay linkine tıkla.
            </p>
          </div>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.includes("gönderildi")
                  ? "bg-neon-green/10 text-neon-green"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {message}
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={resendConfirmationEmail}
              variant="outline"
              className="w-full"
              disabled={resending}
            >
              {resending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Email&apos;i Tekrar Gönder
                </>
              )}
            </Button>

            <Button
              onClick={() => {
                // Check if email is confirmed
                supabase.auth.getUser().then(({ data: { user } }) => {
                  if (user?.email_confirmed_at) {
                    router.push("/onboarding");
                  } else {
                    setMessage("Email henüz onaylanmadı. Lütfen email kutunu kontrol et.");
                  }
                });
              }}
              variant="neon"
              className="w-full"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Onayladım, Devam Et
            </Button>
          </div>

          <div className="pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Email gelmedi mi? Spam klasörünü kontrol et.
            </p>
            <Link href="/auth/login" className="text-sm text-neon-purple hover:underline">
              Giriş sayfasına dön
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

