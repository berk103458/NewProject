"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const supabase = createSupabaseClient();

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");
      const type = searchParams.get("type");

      if (token && type === "signup") {
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: "signup",
          });

          if (error) throw error;

          setStatus("success");
          
          // Check if user has completed onboarding
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: gameProfile } = await supabase
              .from("user_game_profiles")
              .select("id")
              .eq("user_id", user.id)
              .single();

            // If onboarding is completed, go to swipe, otherwise go to onboarding
            setTimeout(() => {
              if (gameProfile) {
                router.push("/swipe");
              } else {
                router.push("/onboarding");
              }
            }, 2000);
          } else {
            setTimeout(() => {
              router.push("/onboarding");
            }, 2000);
          }
        } catch (error) {
          console.error("Verification error:", error);
          setStatus("error");
        }
      } else {
        setStatus("error");
      }
    };

    verifyEmail();
  }, [searchParams, router, supabase]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-neon-purple mb-4" />
            <p className="text-muted-foreground">Email onaylanıyor...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 border-neon-green/20">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-neon-green mb-4" />
            <h2 className="text-2xl font-bold font-gaming mb-2">Email Onaylandı!</h2>
            <p className="text-muted-foreground mb-4">
              Hesabın hazır. Onboarding&apos;e yönlendiriliyorsun...
            </p>
            <Button asChild variant="neonGreen" className="w-full">
              <Link href="/onboarding">Devam Et</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-destructive/20">
        <CardContent className="p-8 text-center">
          <XCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h2 className="text-2xl font-bold font-gaming mb-2">Onay Başarısız</h2>
          <p className="text-muted-foreground mb-4">
            Email onayı başarısız oldu. Lütfen tekrar deneyin.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/login">Giriş Yap</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-neon-purple mb-4" />
            <p className="text-muted-foreground">Yükleniyor...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
