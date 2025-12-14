"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSwipeStore, UserCard } from "@/lib/store/useSwipeStore";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { createSupabaseClient } from "@/lib/supabase/client";
import { UserCard as UserCardComponent } from "@/components/swipe/UserCard";
import { Button } from "@/components/ui/button";
import { Heart, X, RefreshCw, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function SwipePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const supabase = createSupabaseClient();
  const { user, loading: authLoading } = useAuthStore();
  const { currentUsers, currentIndex, setCurrentUsers, swipeUser, nextUser } = useSwipeStore();

  useEffect(() => {
    let mounted = true;
    let hasRedirected = false;
    
    if (authLoading) return;

    if (!user) {
      if (mounted && !hasRedirected && window.location.pathname !== "/onboarding") {
        hasRedirected = true;
        router.replace("/onboarding");
      }
      return;
    }
    
    if (mounted) {
      loadUsers();
    }
    
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const fetchCandidates = async (
    currentProfile: any,
    gameProfile: any,
    options: { checkPersonality: boolean; checkToxicity: boolean }
  ) => {
    const { checkPersonality, checkToxicity } = options;

    // Get completed matches to avoid re-showing; allow pending/rejected so tekrar swipe mümkün
    const { data: existingMatches } = await supabase
      .from("matches")
      .select("user_id_1, user_id_2, status")
      .or(`user_id_1.eq.${user?.id},user_id_2.eq.${user?.id}`)
      .eq("status", "matched");

    const excludedUserIds = new Set<string>([user!.id]);
    existingMatches?.forEach((match) => {
      excludedUserIds.add(match.user_id_1);
      excludedUserIds.add(match.user_id_2);
    });
    const excludedIdsArray = Array.from(excludedUserIds);

    let query = supabase
      .from("profiles")
      .select(
        `
        *,
        user_game_profiles!inner(game_id, role, rank)
      `
      )
      .eq("user_game_profiles.game_id", gameProfile.game_id)
      .neq("id", user!.id);

    if (checkToxicity) {
      query = query.lt("toxicity_score", 70);
    }

    // Optimize: Apply exclusion filter efficiently
    // For small lists, use .neq() chain; for larger lists, filter client-side
    if (excludedIdsArray.length > 0 && excludedIdsArray.length <= 50) {
      // Chain .neq() for reasonable number of exclusions
      excludedIdsArray.forEach((excludedId) => {
        query = query.neq("id", excludedId);
      });
    } else if (excludedIdsArray.length > 50) {
      // For large exclusion lists, fetch more and filter client-side
      query = query.limit(100);
    }

    if (checkPersonality) {
      if (currentProfile.personality_tags?.includes("Tryhard")) {
        query = query.not("personality_tags", "cs", "{Chill}");
      } else if (currentProfile.personality_tags?.includes("Chill")) {
        query = query.not("personality_tags", "cs", "{Tryhard}");
      }
    }

    // Prefer a small random set
    const limit = excludedIdsArray.length > 50 ? 100 : 20;
    query = query.order("updated_at", { ascending: false }).limit(limit);

    const { data: users, error } = await query;
    if (error) throw error;

    // Filter out excluded IDs client-side if needed
    const excludedSet = new Set(excludedIdsArray);
    const filteredUsers = users?.filter((u: any) => !excludedSet.has(u.id)) || [];

    const userCards: UserCard[] =
      filteredUsers.slice(0, 20).map((u: any) => ({
        id: u.id,
        username: u.username,
        avatar_url: u.avatar_url,
        riot_id: u.riot_id,
        rank: u.user_game_profiles?.[0]?.rank || null,
        role: u.user_game_profiles?.[0]?.role || null,
        personality_tags: u.personality_tags || [],
        play_style: u.play_style || "Casual",
        bio: u.bio,
        toxicity_score: u.toxicity_score || 0,
      })) || [];

    return userCards;
  };

  const loadUsers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get current user profile
      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      if (!currentProfile) {
        router.push("/onboarding");
        return;
      }
      setCredits(currentProfile.credits ?? 0);

      // Get user's game profile
      const { data: gameProfile } = await supabase
        .from("user_game_profiles")
        .select("game_id, role")
        .eq("user_id", user.id)
        .single();

      if (!gameProfile) {
        router.push("/onboarding");
        return;
      }

      // Check credits before listing
      const currentCredits = currentProfile.credits ?? 0;
      if (currentCredits < 1) {
        setLoading(false);
        alert("Yeterli kredin yok! Kredi yüklemek için profil sayfasına git.");
        router.push("/profile");
        return;
      }

      // Progressive matching attempts: strict -> wider -> widest
      const attempts = [
        { checkPersonality: true, checkToxicity: true },
        { checkPersonality: false, checkToxicity: true },
        { checkPersonality: false, checkToxicity: false },
      ];

      let found: UserCard[] = [];
      for (const opts of attempts) {
        found = await fetchCandidates(currentProfile, gameProfile, opts);
        if (found.length > 0) break;
      }

      setCurrentUsers(found);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = useCallback(async (direction: "left" | "right") => {
    const currentUser = currentUsers[currentIndex];
    if (!currentUser || !user) return;

    // Check credits before swiping
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.credits || 0) < 1) {
      alert("Yeterli kredin yok! Kredi yüklemek için profil sayfasına git.");
      router.push("/profile");
      return;
    }

    setSwiping(true);
    swipeUser(currentUser.id, direction);

    try {
      // Canonicalize pair to avoid duplicate rows (user_id_1 < user_id_2)
      const [u1, u2] = user.id < currentUser.id ? [user.id, currentUser.id] : [currentUser.id, user.id];
      const newStatus = direction === "right" ? "pending" : "rejected";

      // Check existing pair
      const { data: existing } = await supabase
        .from("matches")
        .select("*")
        .eq("user_id_1", u1)
        .eq("user_id_2", u2)
        .single();

      if (direction === "right") {
        if (existing && existing.status === "pending") {
          // Second right -> matched
          const { error: matchError } = await supabase
            .from("matches")
            .update({ status: "matched" })
            .eq("id", existing.id);
          if (matchError) throw matchError;
          alert(`🎉 MATCH! ${currentUser.username} ile eşleştin!`);
        } else {
          const { error: upsertError } = await supabase
            .from("matches")
            .upsert(
              {
                user_id_1: u1,
                user_id_2: u2,
                status: "pending",
              },
              { onConflict: "user_id_1,user_id_2" }
            );
          if (upsertError) throw upsertError;
        }
      } else {
        // left swipe -> mark rejected
        const { error: rejectError } = await supabase
          .from("matches")
          .upsert(
            {
              user_id_1: u1,
              user_id_2: u2,
              status: "rejected",
            },
            { onConflict: "user_id_1,user_id_2" }
          );
        if (rejectError) throw rejectError;
      }

      // Optimistically update remaining credits
      setCredits((prev) => (prev !== null ? Math.max(prev - 1, 0) : prev));

      // Move to next user
      setTimeout(() => {
        nextUser();
        setOffset({ x: 0, y: 0 });
        setRotation(0);
        setSwiping(false);
      }, 300);
    } catch (error) {
      console.error("Error swiping:", error);
      setSwiping(false);
    }
  }, [currentUsers, currentIndex, user, supabase, router, swipeUser, nextUser]);

  const handleButtonSwipe = useCallback((direction: "left" | "right") => {
    if (swiping) return;
    setOffset({ x: direction === "right" ? 500 : -500, y: 0 });
    setRotation(direction === "right" ? 30 : -30);
    setTimeout(() => handleSwipe(direction), 200);
  }, [swiping, handleSwipe]);

  const currentUser = useMemo(() => currentUsers[currentIndex], [currentUsers, currentIndex]);
  
  const visibleCards = useMemo(() => 
    currentUsers.slice(currentIndex, currentIndex + 2),
    [currentUsers, currentIndex]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold font-gaming mb-4">Daha Fazla Kullanıcı Yok</h2>
          <p className="text-muted-foreground mb-6">
            Şimdilik eşleşebileceğin kullanıcı kalmadı. Daha sonra tekrar kontrol et!
          </p>
          <Button onClick={loadUsers} variant="neon">
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md h-[600px] relative">
        {credits !== null && (
          <div className="absolute -top-2 right-0 left-0 flex justify-center z-50">
            <div className="px-3 py-1 rounded-full bg-card/80 border border-neon-green/40 text-sm text-neon-green backdrop-blur">
              Kalan kredi: <span className="font-semibold">{credits}</span>
            </div>
          </div>
        )}
        {/* Card Stack */}
        <div className="absolute inset-0">
          {visibleCards.map((user, idx) => (
            <div
              key={user.id}
              className="absolute inset-0"
              style={{
                zIndex: currentUsers.length - currentIndex - idx,
                transform: idx === 0 ? "scale(1)" : "scale(0.95)",
                opacity: idx === 0 ? 1 : 0.8,
              }}
            >
              <UserCardComponent
                user={user}
                onSwipe={handleSwipe}
                offset={idx === 0 ? offset : { x: 0, y: 0 }}
                rotation={idx === 0 ? rotation : 0}
              />
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4 z-50">
          <Button
            size="lg"
            variant="destructive"
            className="rounded-full w-16 h-16"
            onClick={() => handleButtonSwipe("left")}
            disabled={swiping}
          >
            <X className="w-8 h-8" />
          </Button>
          <Button
            size="lg"
            variant="neonGreen"
            className="rounded-full w-16 h-16"
            onClick={() => handleButtonSwipe("right")}
            disabled={swiping}
          >
            <Heart className="w-8 h-8" />
          </Button>
        </div>
      </div>
    </div>
  );
}

