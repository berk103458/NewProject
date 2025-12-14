"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Coins, TrendingUp, Shield, Loader2, Search, Plus, Minus, RefreshCw, Trash2, Eye, EyeOff } from "lucide-react";

interface User {
  id: string;
  username: string;
  email: string;
  credits: number;
  user_points: number;
  toxicity_score: number;
  is_admin: boolean;
  created_at: string;
  bio: string | null;
  riot_id: string | null;
  avatar_url: string | null;
  personality_tags: string[];
  play_style: string;
  match_count?: number;
  message_count?: number;
  last_seen?: string | null;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [creditAmount, setCreditAmount] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const supabase = createSupabaseClient();
  const { user } = useAuthStore();

  useEffect(() => {
    checkAdminAccess();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAdminAccess = async () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (!profile?.is_admin) {
        router.push("/");
        return;
      }

      setIsAdmin(true);
      loadUsers();
    } catch (error) {
      console.error("Error checking admin:", error);
      router.push("/");
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id, 
          username, 
          credits, 
          user_points, 
          toxicity_score, 
          is_admin, 
          created_at,
          bio,
          riot_id,
          avatar_url,
          personality_tags,
          play_style,
          last_seen
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const userIds = (data || []).map((u) => u.id);

      // Batch fetch match counts
      const { data: allMatches } = await supabase
        .from("matches")
        .select("user_id_1, user_id_2")
        .eq("status", "matched")
        .or(userIds.map((id) => `user_id_1.eq.${id},user_id_2.eq.${id}`).join(","));

      const matchCounts = new Map<string, number>();
      allMatches?.forEach((match) => {
        matchCounts.set(match.user_id_1, (matchCounts.get(match.user_id_1) || 0) + 1);
        matchCounts.set(match.user_id_2, (matchCounts.get(match.user_id_2) || 0) + 1);
      });

      // Batch fetch message counts
      const { data: allMessages } = await supabase
        .from("messages")
        .select("sender_id")
        .in("sender_id", userIds);

      const messageCounts = new Map<string, number>();
      allMessages?.forEach((msg) => {
        messageCounts.set(msg.sender_id, (messageCounts.get(msg.sender_id) || 0) + 1);
      });

      // Get emails in parallel (but limit concurrent requests)
      const usersWithDetails = await Promise.all(
        (data || []).map(async (u) => {
          let email = "N/A";
          try {
            const response = await fetch(`/api/admin/users/${u.id}`);
            if (response.ok) {
              const emailData = await response.json();
              email = emailData.email || "N/A";
            }
          } catch {
            // API not available, use N/A
            email = "N/A";
          }

          return {
            ...u,
            email,
            match_count: matchCounts.get(u.id) || 0,
            message_count: messageCounts.get(u.id) || 0,
          };
        })
      );

      setUsers(usersWithDetails);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const addCredits = async (userId: string, amount: number) => {
    try {
      const response = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount, action: "add" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Kredi eklenemedi");
      }
      loadUsers();
      setSelectedUserId(null);
      setCreditAmount(1);
    } catch (error) {
      console.error("Error adding credits:", error);
      alert("Kredi eklenirken hata oluştu");
    }
  };

  const removeCredits = async (userId: string, amount: number) => {
    try {
      const response = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount, action: "remove" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Kredi çıkarılamadı");
      }
      loadUsers();
      setSelectedUserId(null);
      setCreditAmount(1);
    } catch (error) {
      console.error("Error removing credits:", error);
      alert("Kredi çıkarılırken hata oluştu");
    }
  };

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Bu kullanıcıyı ${currentStatus ? "admin" : "admin olmayan"} yapmak istediğinden emin misin?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_admin: !currentStatus })
        .eq("id", userId);

      if (error) throw error;

      loadUsers();
    } catch (error) {
      console.error("Error toggling admin:", error);
      alert("Admin durumu değiştirilirken hata oluştu");
    }
  };

  const deleteUser = async (userId: string, username: string) => {
    if (!confirm(`"${username}" kullanıcısını silmek istediğinden emin misin? Bu işlem geri alınamaz!`)) {
      return;
    }

    try {
      // Delete user via API (uses service role key)
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Kullanıcı silinemedi");
      }

      loadUsers();
      alert("Kullanıcı başarıyla silindi");
    } catch (error: any) {
      console.error("Error deleting user:", error);
      alert(`Kullanıcı silinirken hata oluştu: ${error.message}`);
    }
  };

  const toggleUserDetails = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold font-gaming">
              <span className="text-neon-purple">Admin</span> Panel
            </h1>
            <p className="text-muted-foreground">Kullanıcı ve kredi yönetimi</p>
          </div>
          <Button onClick={loadUsers} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Kullanıcı</p>
                  <p className="text-2xl font-bold font-gaming">{users.length}</p>
                </div>
                <Users className="w-8 h-8 text-neon-purple" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Kredi</p>
                  <p className="text-2xl font-bold font-gaming">
                    {users.reduce((sum, u) => sum + (u.credits || 0), 0)}
                  </p>
                </div>
                <Coins className="w-8 h-8 text-neon-green" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ortalama Toxicity</p>
                  <p className="text-2xl font-bold font-gaming">
                    {users.length > 0
                      ? Math.round(
                          users.reduce((sum, u) => sum + (u.toxicity_score || 0), 0) / users.length
                        )
                      : 0}
                  </p>
                </div>
                <Shield className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Puan</p>
                  <p className="text-2xl font-bold font-gaming">
                    {users.reduce((sum, u) => sum + (u.user_points || 0), 0)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-neon-purple" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Kullanıcı ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-input border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-neon-purple"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Kullanıcılar</CardTitle>
            <CardDescription>{filteredUsers.length} kullanıcı bulundu</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2">Kullanıcı</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Kredi</th>
                      <th className="text-left p-2">Puan</th>
                      <th className="text-left p-2">Toxicity</th>
                      <th className="text-left p-2">Durum</th>
                      <th className="text-left p-2">Eşleşme</th>
                      <th className="text-left p-2">Admin</th>
                      <th className="text-left p-2">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <>
                        <tr key={u.id} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="p-2">
                            <div>
                              <p className="font-semibold">{u.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(u.created_at).toLocaleDateString("tr-TR")}
                              </p>
                            </div>
                          </td>
                          <td className="p-2">
                            <p className="text-sm">{u.email}</p>
                          </td>
                          <td className="p-2">
                            <span className="font-bold text-neon-green">{u.credits || 0}</span>
                          </td>
                          <td className="p-2">{u.user_points || 0}</td>
                          <td className="p-2">
                            <span
                              className={
                                (u.toxicity_score || 0) < 20
                                  ? "text-neon-green"
                                  : (u.toxicity_score || 0) < 50
                                  ? "text-yellow-500"
                                  : "text-red-500"
                              }
                            >
                              {u.toxicity_score || 0}
                            </span>
                          </td>
                          <td className="p-2">
                            {u.last_seen ? (
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  Date.now() - new Date(u.last_seen).getTime() < 5 * 60 * 1000
                                    ? "bg-neon-green/20 text-neon-green border border-neon-green/40"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {Date.now() - new Date(u.last_seen).getTime() < 5 * 60 * 1000
                                  ? "Online"
                                  : "Offline"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Bilinmiyor</span>
                            )}
                          </td>
                          <td className="p-2">
                            <span className="text-sm">{u.match_count || 0}</span>
                          </td>
                          <td className="p-2">
                            {u.is_admin ? (
                              <span className="px-2 py-1 rounded bg-neon-purple/20 text-neon-purple text-xs">
                                Admin
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Kullanıcı</span>
                            )}
                          </td>
                          <td className="p-2">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleUserDetails(u.id)}
                              >
                                {expandedUsers.has(u.id) ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              {selectedUserId === u.id ? (
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="number"
                                    min="1"
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(parseInt(e.target.value) || 1)}
                                    className="w-16 px-2 py-1 rounded bg-input border border-input text-sm"
                                  />
                                  <Button
                                    size="sm"
                                    variant="neonGreen"
                                    onClick={() => addCredits(u.id, creditAmount)}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => removeCredits(u.id, creditAmount)}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedUserId(null)}
                                  >
                                    İptal
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedUserId(u.id);
                                      setCreditAmount(1);
                                    }}
                                  >
                                    Kredi
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={u.is_admin ? "destructive" : "neon"}
                                    onClick={() => toggleAdmin(u.id, u.is_admin)}
                                  >
                                    {u.is_admin ? "Admin Kaldır" : "Admin Yap"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteUser(u.id, u.username)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedUsers.has(u.id) && (
                          <tr key={`${u.id}-details`} className="bg-muted/30">
                            <td colSpan={8} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="font-semibold mb-1">Bio</p>
                                  <p className="text-muted-foreground">{u.bio || "Yok"}</p>
                                </div>
                                <div>
                                  <p className="font-semibold mb-1">Riot ID</p>
                                  <p className="text-muted-foreground">{u.riot_id || "Yok"}</p>
                                </div>
                                <div>
                                  <p className="font-semibold mb-1">Oyun Stili</p>
                                  <p className="text-muted-foreground capitalize">{u.play_style || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="font-semibold mb-1">Mesaj Sayısı</p>
                                  <p className="text-muted-foreground">{u.message_count || 0}</p>
                                </div>
                                <div className="col-span-2 md:col-span-4">
                                  <p className="font-semibold mb-1">Kişilik Etiketleri</p>
                                  <div className="flex flex-wrap gap-2">
                                    {u.personality_tags?.map((tag) => (
                                      <span
                                        key={tag}
                                        className="px-2 py-1 text-xs rounded-full bg-neon-purple/20 text-neon-purple border border-neon-purple/30"
                                      >
                                        {tag.replace("_", " ")}
                                      </span>
                                    )) || <span className="text-muted-foreground">Yok</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

