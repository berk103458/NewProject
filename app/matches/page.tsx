"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, User, Loader2, Heart, Loader } from "lucide-react";
import Link from "next/link";

interface Match {
  id: string;
  user_id_1: string;
  user_id_2: string;
  status: string;
  created_at: string;
  matched_user: {
    id: string;
    username: string;
    avatar_url: string | null;
    riot_id: string | null;
    bio: string | null;
  };
  unread_count?: number;
}

export default function MatchesPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const supabase = createSupabaseClient();
  const { user, loading: authLoading } = useAuthStore();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const loadMatches = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get all matched users
      const { data: matchesData, error } = await supabase
        .from("matches")
        .select("*")
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
        .eq("status", "matched")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Deduplicate mirrored records using canonical pair key
      const uniqueMap = new Map<string, any>();
      (matchesData || []).forEach((m) => {
        const key =
          m.user_id_1 < m.user_id_2
            ? `${m.user_id_1}-${m.user_id_2}`
            : `${m.user_id_2}-${m.user_id_1}`;
        if (!uniqueMap.has(key)) uniqueMap.set(key, m);
      });

      const uniqueMatches = Array.from(uniqueMap.values());
      const otherUserIds = uniqueMatches.map(
        (match) => (match.user_id_1 === user.id ? match.user_id_2 : match.user_id_1)
      );
      const matchIds = uniqueMatches.map((m) => m.id);

      // Batch fetch all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, riot_id, bio")
        .in("id", otherUserIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      );

      // Batch fetch all unread counts
      const { data: unreadMessages } = await supabase
        .from("messages")
        .select("match_id")
        .in("match_id", matchIds)
        .eq("read", false)
        .neq("sender_id", user.id);

      const unreadCounts = new Map<string, number>();
      unreadMessages?.forEach((msg) => {
        unreadCounts.set(msg.match_id, (unreadCounts.get(msg.match_id) || 0) + 1);
      });

      // Combine data
      const matchesWithProfiles = uniqueMatches.map((match) => {
        const otherUserId = match.user_id_1 === user.id ? match.user_id_2 : match.user_id_1;
        const profile = profileMap.get(otherUserId);

        return {
          ...match,
          matched_user: profile || {
            id: otherUserId,
            username: "Unknown",
            avatar_url: null,
            riot_id: null,
            bio: null,
          },
          unread_count: unreadCounts.get(match.id) || 0,
        };
      });

      setMatches(matchesWithProfiles);
    } catch (error) {
      console.error("Error loading matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeMatch = async (targetUserId: string) => {
    if (!user) return;
    setRemovingId(targetUserId);
    try {
      const response = await fetch("/api/matches/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Eşleşme kaldırılamadı");
      }
      await loadMatches();
    } catch (error) {
      console.error("Error removing match:", error);
      alert(error instanceof Error ? error.message : "Eşleşme kaldırılırken hata oluştu");
    } finally {
      setRemovingId(null);
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold font-gaming mb-2">
            <span className="text-neon-purple">Eşleşmeler</span>
          </h1>
          <p className="text-muted-foreground">
            {matches.length === 0
              ? "Henüz eşleşmen yok. Swipe sayfasından eşleşmeye başla!"
              : `${matches.length} eşleşme bulundu`}
          </p>
        </div>

        {matches.length === 0 ? (
          <Card className="p-12 text-center">
            <Heart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Henüz Eşleşme Yok</h2>
            <p className="text-muted-foreground mb-6">
              Swipe sayfasından oyun arkadaşları bul ve eşleş!
            </p>
            <Button asChild variant="neon">
              <Link href="/swipe">Swipe&apos;a Git</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((match) => (
              <Card
                key={match.id}
                className="border-2 border-neon-purple/20 hover:border-neon-purple/50 transition-all cursor-pointer"
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-purple to-neon-green flex items-center justify-center text-xl font-bold border-4 border-neon-purple overflow-hidden">
                      {match.matched_user.avatar_url ? (
                        <Image
                          src={match.matched_user.avatar_url}
                          alt={match.matched_user.username}
                          width={64}
                          height={64}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span>{match.matched_user.username.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-gaming text-neon-purple">
                        {match.matched_user.username}
                      </CardTitle>
                      {match.matched_user.riot_id && (
                        <p className="text-sm text-muted-foreground">
                          #{match.matched_user.riot_id}
                        </p>
                      )}
                    </div>
                    {match.unread_count && match.unread_count > 0 && (
                      <div className="bg-neon-green text-black rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {match.unread_count}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {match.matched_user.bio && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {match.matched_user.bio}
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    <Button asChild variant="neon" className="w-full">
                      <Link href={`/chat/${match.id}`}>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Mesaj Gönder
                      </Link>
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/profile/${match.matched_user.id || ""}`)}
                        className="flex-1"
                      >
                        <User className="w-4 h-4 mr-2" />
                        Profile Bak
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => removeMatch(match.matched_user.id)}
                        disabled={removingId === match.matched_user.id}
                      >
                        {removingId === match.matched_user.id ? (
                          <>
                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                            Kaldırılıyor...
                          </>
                        ) : (
                          "Eşleşmeyi Kaldır"
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

