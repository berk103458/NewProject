"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gamepad2, Plus, Trash2, RefreshCw, Loader2, Trophy, Target, Zap } from "lucide-react";
import { SUPPORTED_GAMES } from "@/lib/constants";

interface GameAccount {
  id: string;
  game_id: string;
  game_username: string;
  game_tag: string | null;
  region: string;
  rank: string | null;
  tier: string | null;
  level: number | null;
  is_verified: boolean;
  game: {
    name: string;
    slug: string;
  };
  statistics?: {
    winrate: number;
    total_games: number;
    wins: number;
    losses: number;
    kda: number;
    avg_farm: number;
  };
}

export default function GameAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [syncingAccount, setSyncingAccount] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [gameUsername, setGameUsername] = useState("");
  const [gameTag, setGameTag] = useState("");
  const [region, setRegion] = useState("TR");
  const supabase = createSupabaseClient();
  const { user, loading: authLoading } = useAuthStore();

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    if (!user) {
      router.push("/auth/login");
      return;
    }
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const loadAccounts = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("game_accounts")
        .select(`
          *,
          games(name, slug)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const accountIds = (data || []).map((acc: any) => acc.id);

      // Batch fetch all statistics
      const { data: allStats } = await supabase
        .from("game_statistics")
        .select("*")
        .in("game_account_id", accountIds)
        .order("updated_at", { ascending: false });

      // Group by account_id and get latest for each
      const statsMap = new Map<string, any>();
      allStats?.forEach((stat) => {
        const existing = statsMap.get(stat.game_account_id);
        if (!existing || new Date(stat.updated_at) > new Date(existing.updated_at)) {
          statsMap.set(stat.game_account_id, stat);
        }
      });

      // Combine data
      const accountsWithStats = (data || []).map((acc: any) => ({
        ...acc,
        game: acc.games,
        statistics: statsMap.get(acc.id) || null,
      }));

      setAccounts(accountsWithStats);
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const addGameAccount = async () => {
    if (!user || !selectedGame || !gameUsername) return;

    setAdding(true);
    try {
      // Get game ID
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("id")
        .eq("slug", selectedGame)
        .single();

      if (gameError) throw gameError;

      const { error } = await supabase.from("game_accounts").insert({
        user_id: user.id,
        game_id: gameData.id,
        game_username: gameUsername,
        game_tag: gameTag || null,
        region: region,
      });

      if (error) throw error;

      // Create initial statistics
      const { data: accountData } = await supabase
        .from("game_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("game_id", gameData.id)
        .single();

      if (accountData) {
        await supabase.from("game_statistics").insert({
          game_account_id: accountData.id,
          season: "2024",
        });
      }

      setSelectedGame(null);
      setGameUsername("");
      setGameTag("");
      setRegion("TR");
      loadAccounts();
    } catch (error: any) {
      console.error("Error adding account:", error);
      alert(`Hesap eklenirken hata oluştu: ${error.message}`);
    } finally {
      setAdding(false);
    }
  };

  const deleteAccount = async (accountId: string) => {
    if (!confirm("Bu oyun hesabını silmek istediğinden emin misin?")) return;

    try {
      const { error } = await supabase
        .from("game_accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;

      loadAccounts();
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Hesap silinirken hata oluştu");
    }
  };

  const syncAccount = async (accountId: string) => {
    setSyncingAccount(accountId);
    try {
      const response = await fetch(`/api/games/sync/${accountId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Hesap senkronize edilemedi.");
      }

      alert("Hesap başarıyla senkronize edildi!");
      loadAccounts();
    } catch (error: any) {
      console.error("Error syncing account:", error);
      const errorMessage = error.message || "Bilinmeyen hata";
      
      // Show more helpful error message for 403
      if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
        alert(
          "Riot API hatası: 403 Forbidden\n\n" +
          "Olası nedenler:\n" +
          "• API key geçersiz veya süresi dolmuş\n" +
          "• Development API key'i 24 saat sonra geçersiz olur\n" +
          "• IP adresi whitelist'te değil\n" +
          "• API key'in gerekli yetkileri yok\n\n" +
          "Lütfen .env.local dosyasındaki RIOT_API_KEY'i kontrol edin."
        );
      } else {
        alert(`Hesap senkronize edilirken hata oluştu: ${errorMessage}`);
      }
    } finally {
      setSyncingAccount(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold font-gaming">
              <span className="text-neon-purple">Oyun Hesapları</span>
            </h1>
            <p className="text-muted-foreground">Oyun hesaplarını bağla ve istatistiklerini gör</p>
          </div>
          <Button onClick={() => router.push("/profile")} variant="outline">
            Profil&apos;e Dön
          </Button>
        </div>

        {/* Add Account Form */}
        <Card>
          <CardHeader>
            <CardTitle>Yeni Oyun Hesabı Bağla</CardTitle>
            <CardDescription>Riot Games hesabını bağla (LoL, Valorant)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Oyun</label>
              <div className="grid grid-cols-3 gap-2">
                {SUPPORTED_GAMES.map((game) => (
                  <Button
                    key={game.id}
                    variant={selectedGame === game.id ? "neon" : "outline"}
                    onClick={() => setSelectedGame(game.id)}
                  >
                    {game.name}
                  </Button>
                ))}
              </div>
            </div>

            {selectedGame && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Kullanıcı Adı</label>
                  <Input
                    value={gameUsername}
                    onChange={(e) => setGameUsername(e.target.value)}
                    placeholder="Riot ID"
                  />
                </div>

                {(selectedGame === "valorant" || selectedGame === "lol") && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Tag</label>
                    <Input
                      value={gameTag}
                      onChange={(e) => setGameTag(e.target.value)}
                      placeholder="#TAG (Valorant için)"
                    />
                  </div>
                )}

                {selectedGame === "lol" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Region</label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-input border border-input text-foreground"
                    >
                      <option value="TR">TR (Türkiye)</option>
                      <option value="EUW">EUW (Avrupa Batı)</option>
                      <option value="EUNE">EUNE (Avrupa Kuzey-Doğu)</option>
                      <option value="NA">NA (Kuzey Amerika)</option>
                    </select>
                  </div>
                )}

                <Button
                  onClick={addGameAccount}
                  variant="neonGreen"
                  className="w-full"
                  disabled={adding || !gameUsername}
                >
                  {adding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Ekleniyor...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Hesap Ekle
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Connected Accounts */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold font-gaming">Bağlı Hesaplar</h2>

          {accounts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Gamepad2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Henüz oyun hesabı bağlanmamış</p>
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
              <Card 
                key={account.id} 
                className="border-2 border-neon-purple/20 hover:border-neon-purple/50 transition-all cursor-pointer"
                onClick={() => router.push(`/profile/game-accounts/${account.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Gamepad2 className="w-5 h-5 text-neon-purple" />
                        {account.game.name}
                      </CardTitle>
                      <CardDescription>
                        {account.game_username}
                        {account.game_tag && `#${account.game_tag}`}
                        {account.region && ` (${account.region})`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncAccount(account.id)}
                        disabled={syncingAccount === account.id}
                      >
                        {syncingAccount === account.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteAccount(account.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {account.statistics ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <Trophy className="w-5 h-5 mx-auto text-neon-green mb-1" />
                        <p className="text-2xl font-bold font-gaming text-neon-green">
                          {account.statistics.winrate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">Winrate</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <Target className="w-5 h-5 mx-auto text-neon-purple mb-1" />
                        <p className="text-2xl font-bold font-gaming text-neon-purple">
                          {account.statistics.kda.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">KDA</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <Zap className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
                        <p className="text-2xl font-bold font-gaming text-yellow-500">
                          {account.statistics.total_games}
                        </p>
                        <p className="text-xs text-muted-foreground">Toplam Oyun</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold font-gaming">
                          {account.statistics.avg_farm}
                        </p>
                        <p className="text-xs text-muted-foreground">Ortalama Farm</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      İstatistikler henüz yüklenmedi. Senkronize et butonuna tıkla.
                    </p>
                  )}

                  {account.rank && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Rank: </span>
                        <span className="font-semibold">{account.rank}</span>
                        {account.tier && ` ${account.tier}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

