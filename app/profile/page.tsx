"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Coins, Wallet, Edit, LogOut, Loader2, Gamepad2 } from "lucide-react";
import { Database } from "@/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameProfile, setGameProfile] = useState<any>(null);
  const supabase = createSupabaseClient();
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.push("/onboarding");
      return;
    }
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);

      // Load game profile
      const { data: gameData } = await supabase
        .from("user_game_profiles")
        .select("*, games(*)")
        .eq("user_id", user.id)
        .single();

      setGameProfile(gameData);
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8">
          <p className="text-muted-foreground">Profil bulunamadı.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold font-gaming">
            <span className="text-neon-purple">Profil</span>
          </h1>
          <div className="flex gap-2">
            {profile.is_admin && (
              <Button variant="neon" onClick={() => router.push("/admin")}>
                Admin Panel
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Çıkış Yap
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="md:col-span-2 border-2 border-neon-purple/20">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-neon-purple to-neon-green flex items-center justify-center text-2xl font-bold border-4 border-neon-purple overflow-hidden">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={profile.username}
                      width={80}
                      height={80}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>{profile.username.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl font-gaming">{profile.username}</CardTitle>
                  {profile.riot_id && (
                    <CardDescription>#{profile.riot_id}</CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.bio && (
                <div>
                  <h3 className="font-semibold mb-2">Hakkımda</h3>
                  <p className="text-sm text-muted-foreground">{profile.bio}</p>
                </div>
              )}

              {gameProfile && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4" />
                    Oyun Bilgileri
                  </h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Oyun: </span>
                      {gameProfile.games?.name}
                    </p>
                    {gameProfile.role && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Rol: </span>
                        {gameProfile.role}
                      </p>
                    )}
                    {gameProfile.rank && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Rank: </span>
                        {gameProfile.rank}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => router.push("/onboarding?change_game=true")}
                  >
                    Oyunu Değiştir
                  </Button>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Oyun Stili</h3>
                <p className="text-sm text-muted-foreground capitalize">{profile.play_style}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Kişilik Etiketleri</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.personality_tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs rounded-full bg-neon-purple/20 text-neon-purple border border-neon-purple/30"
                    >
                      {tag.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Güvenilirlik Skoru</h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neon-green transition-all"
                      style={{ width: `${100 - profile.toxicity_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-neon-green">
                    {100 - profile.toxicity_score}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Wallet Card */}
          <Card className="border-2 border-neon-green/20 bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-neon-green" />
                Gamer Wallet
              </CardTitle>
              <CardDescription>Puanların ve kredilerin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Points */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-neon-purple" />
                    <span className="font-semibold">Puanlar</span>
                  </div>
                  <span className="text-2xl font-bold font-gaming text-neon-purple">
                    {profile.user_points || 0}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Eşleşmeler ve oyunlar için puan kazan
                </p>
              </div>

              {/* Credits */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-neon-green" />
                    <span className="font-semibold">Kredi</span>
                  </div>
                  <span className="text-2xl font-bold font-gaming text-neon-green">
                    {profile.credits || 0}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Her swipe için 1 kredi harcanır
                </p>
              </div>

              {/* Earning Info */}
              <div className="pt-4 border-t border-border">
                <h4 className="font-semibold text-sm mb-2">Puan Kazanma</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Eşleşme: +10 Puan</li>
                  <li>• 3 Oyun Oyna: +50 Puan</li>
                  <li>• Profil Tamamla: +20 Puan</li>
                </ul>
              </div>

              <Button variant="neonGreen" className="w-full" disabled>
                Yakında: Para Yükle
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Game Accounts Link */}
        <Card className="border-2 border-neon-purple/20">
          <CardContent className="p-6">
            <Button asChild variant="outline" className="w-full" size="lg">
              <Link href="/profile/game-accounts">
                <Gamepad2 className="w-5 h-5 mr-2" />
                Oyun Hesapları
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Riot Games hesaplarını bağla ve istatistiklerini gör
            </p>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>İstatistikler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold font-gaming text-neon-purple">-</p>
                <p className="text-sm text-muted-foreground">Toplam Eşleşme</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-gaming text-neon-green">-</p>
                <p className="text-sm text-muted-foreground">Oynanan Oyun</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-gaming text-neon-purple">
                  {profile.toxicity_score}
                </p>
                <p className="text-sm text-muted-foreground">Toxicity Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-gaming text-neon-green">
                  {profile.user_points || 0}
                </p>
                <p className="text-sm text-muted-foreground">Toplam Puan</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

