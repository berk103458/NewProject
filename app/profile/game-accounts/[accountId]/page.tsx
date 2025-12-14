"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Target, Zap, TrendingUp, Loader2, Swords, Clock, Users, BarChart3, Award } from "lucide-react";
import Link from "next/link";

interface Match {
  id: string;
  champion: string | null;
  agent: string | null;
  result: "win" | "loss";
  kills: number;
  deaths: number;
  assists: number;
  farm: number;
  damage: number;
  match_duration: number | null;
  match_date: string;
  game_mode: string | null;
  role: string | null;
}

interface Statistics {
  winrate: number;
  total_games: number;
  wins: number;
  losses: number;
  kda: number;
  avg_farm: number;
  avg_damage: number;
  favorite_champion: string | null;
  favorite_agent: string | null;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
}

export default function GameAccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;
  const [account, setAccount] = useState<any>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseClient();
  const { user, loading: authLoading } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    let hasRedirected = false;

    if (authLoading) return; // Wait for auth to load
    if (!user) {
      if (mounted && !hasRedirected && window.location.pathname !== "/auth/login") {
        hasRedirected = true;
        router.replace("/auth/login");
      }
      return;
    }
    
    if (mounted) {
      loadAccountDetails();
    }

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, user, authLoading]);

  const loadAccountDetails = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load account
      const { data: accountData, error: accountError } = await supabase
        .from("game_accounts")
        .select("*, games(name, slug)")
        .eq("id", accountId)
        .single();

      if (accountError) throw accountError;
      setAccount(accountData);

      // Load statistics
      const { data: statsData, error: statsError } = await supabase
        .from("game_statistics")
        .select("*")
        .eq("game_account_id", accountId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (statsError) {
        console.error("Error loading statistics:", statsError);
      }
      
      console.log("Loaded statistics:", {
        accountId,
        statsData,
        hasStats: !!statsData,
      });
      
      setStatistics(statsData || null);

      // Load recent matches
      const { data: matchesData } = await supabase
        .from("recent_matches")
        .select("*")
        .eq("game_account_id", accountId)
        .order("match_date", { ascending: false })
        .limit(20);

      setRecentMatches(matchesData || []);
    } catch (error) {
      console.error("Error loading account details:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate win streak
  const getWinStreak = () => {
    let streak = 0;
    for (const match of recentMatches) {
      if (match.result === "win") streak++;
      else break;
    }
    return streak;
  };

  // Calculate loss streak
  const getLossStreak = () => {
    let streak = 0;
    for (const match of recentMatches) {
      if (match.result === "loss") streak++;
      else break;
    }
    return streak;
  };

  // Calculate average KDA from recent matches
  const getRecentAvgKDA = () => {
    if (recentMatches.length === 0) return 0;
    let totalKDA = 0;
    for (const match of recentMatches) {
      const kda = match.deaths > 0 ? (match.kills + match.assists) / match.deaths : match.kills + match.assists;
      totalKDA += kda;
    }
    return totalKDA / recentMatches.length;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Hesap bulunamadı</p>
          <Button asChild variant="outline">
            <Link href="/profile/game-accounts">Geri Dön</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const gameSlug = (account.games as any)?.slug;
  const isValorant = gameSlug === "valorant";
  const isLoL = gameSlug === "lol";

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/profile/game-accounts">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-4xl font-bold font-gaming">
                <span className="text-neon-purple">{(account.games as any).name}</span>
              </h1>
              <p className="text-muted-foreground">
                {account.game_username}
                {account.game_tag && `#${account.game_tag}`}
                {account.region && ` (${account.region})`}
              </p>
            </div>
          </div>
          {account.rank && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Rank</p>
              <p className="text-2xl font-bold font-gaming text-neon-green">
                {account.rank} {account.tier}
              </p>
            </div>
          )}
        </div>

        {/* Main Statistics Grid */}
        {statistics ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-2 border-neon-green/20">
              <CardContent className="p-6 text-center">
                <Trophy className="w-8 h-8 mx-auto text-neon-green mb-2" />
                <p className="text-3xl font-bold font-gaming text-neon-green">
                  {statistics.winrate.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">Winrate</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {statistics.wins}W - {statistics.losses}L
                </p>
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {getWinStreak() > 0 && `🔥 ${getWinStreak()} Win Streak`}
                    {getLossStreak() > 0 && `❄️ ${getLossStreak()} Loss Streak`}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-neon-purple/20">
              <CardContent className="p-6 text-center">
                <Target className="w-8 h-8 mx-auto text-neon-purple mb-2" />
                <p className="text-3xl font-bold font-gaming text-neon-purple">
                  {statistics.kda.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">KDA</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {statistics.total_kills || 0}K / {statistics.total_deaths || 0}D / {statistics.total_assists || 0}A
                </p>
                {recentMatches.length > 0 && (
                  <p className="text-xs text-neon-purple mt-1">
                    Son {recentMatches.length} oyun: {getRecentAvgKDA().toFixed(2)} KDA
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-2 border-yellow-500/20">
              <CardContent className="p-6 text-center">
                <Zap className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
                <p className="text-3xl font-bold font-gaming text-yellow-500">
                  {statistics.total_games}
                </p>
                <p className="text-sm text-muted-foreground">Toplam Oyun</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {recentMatches.length} son maç yüklendi
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 border-blue-500/20">
              <CardContent className="p-6 text-center">
                <Swords className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                <p className="text-3xl font-bold font-gaming text-blue-500">
                  {isLoL ? statistics.avg_farm?.toFixed(0) || 0 : statistics.avg_damage?.toFixed(0) || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isLoL ? "Ort. Farm" : "Ort. Hasar"}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">İstatistikler henüz yüklenmedi</p>
              <p className="text-sm text-muted-foreground mb-2">
                Hesabı senkronize et butonuna tıklayarak istatistikleri yükle
              </p>
              {isValorant && (
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-xs text-yellow-500 mb-1">⚠️ Valorant Match History</p>
                  <p className="text-xs text-muted-foreground">
                    Valorant match history için Riot API production key gerekiyor. 
                    Development key&apos;ler match history&apos;ye erişemez. 
                    Account bilgileri (rank, level) gösteriliyor.
                  </p>
                </div>
              )}
              {account.last_synced_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Son senkronizasyon: {new Date(account.last_synced_at).toLocaleString("tr-TR")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Detailed Stats */}
        {statistics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-neon-purple" />
                  Detaylı İstatistikler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Toplam Öldürme</p>
                    <p className="text-2xl font-bold font-gaming text-neon-green">
                      {statistics.total_kills || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Toplam Ölüm</p>
                    <p className="text-2xl font-bold font-gaming text-red-500">
                      {statistics.total_deaths || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Toplam Asist</p>
                    <p className="text-2xl font-bold font-gaming text-blue-500">
                      {statistics.total_assists || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ortalama Hasar</p>
                    <p className="text-2xl font-bold font-gaming">
                      {statistics.avg_damage?.toFixed(0) || 0}
                    </p>
                  </div>
                </div>
                {(statistics.favorite_champion || statistics.favorite_agent) && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">En Çok Oynanan</p>
                    <p className="text-xl font-bold font-gaming text-neon-purple">
                      {statistics.favorite_champion || statistics.favorite_agent}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-neon-green" />
                  Performans Özeti
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Kazanma Oranı</span>
                    <span className="text-sm font-semibold">{statistics.winrate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neon-green transition-all"
                      style={{ width: `${statistics.winrate}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">KDA Oranı</span>
                    <span className="text-sm font-semibold">{statistics.kda.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neon-purple transition-all"
                      style={{ width: `${Math.min(statistics.kda * 10, 100)}%` }}
                    />
                  </div>
                </div>
                {recentMatches.length > 0 && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-2">Son {recentMatches.length} Oyun</p>
                    <div className="flex gap-1">
                      {recentMatches.slice(0, 10).map((match, idx) => (
                        <div
                          key={idx}
                          className={`w-6 h-6 rounded ${
                            match.result === "win" ? "bg-neon-green" : "bg-red-500"
                          }`}
                          title={`${match.result === "win" ? "Kazandı" : "Kaybetti"} - ${new Date(match.match_date).toLocaleDateString("tr-TR")}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Recent Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-neon-purple" />
              Son Oynanan Oyunlar
            </CardTitle>
            <CardDescription>Son {recentMatches.length} oyun detayları</CardDescription>
          </CardHeader>
          <CardContent>
            {recentMatches.length === 0 ? (
              <div className="text-center py-12">
                <Swords className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Henüz oyun kaydı yok.
                </p>
                <p className="text-sm text-muted-foreground">
                  Hesabı senkronize et butonuna tıklayarak maç geçmişini yükle.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMatches.map((match) => (
                  <div
                    key={match.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      match.result === "win"
                        ? "border-neon-green/50 bg-neon-green/5 hover:bg-neon-green/10"
                        : "border-red-500/50 bg-red-500/5 hover:bg-red-500/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${
                            match.result === "win"
                              ? "bg-neon-green text-black"
                              : "bg-red-500 text-white"
                          }`}
                        >
                          {match.result === "win" ? "W" : "L"}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-lg">
                              {match.champion || match.agent || "N/A"}
                            </p>
                            {match.role && (
                              <span className="px-2 py-1 text-xs rounded-full bg-muted/50 text-muted-foreground">
                                {match.role}
                              </span>
                            )}
                            {match.game_mode && (
                              <span className="px-2 py-1 text-xs rounded-full bg-muted/50 text-muted-foreground">
                                {match.game_mode}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {match.match_duration ? `${Math.floor(match.match_duration / 60)} dk` : "N/A"}
                            </span>
                            <span>
                              {new Date(match.match_date).toLocaleDateString("tr-TR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold font-gaming mb-1">
                          {match.kills}/{match.deaths}/{match.assists}
                        </p>
                        <p className="text-sm text-muted-foreground mb-1">
                          KDA: {((match.kills + match.assists) / Math.max(match.deaths, 1)).toFixed(2)}
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {isLoL && match.farm > 0 && (
                            <span>CS: {match.farm}</span>
                          )}
                          {match.damage > 0 && (
                            <span>Hasar: {match.damage.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
