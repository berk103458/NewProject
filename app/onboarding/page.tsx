"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/store/useOnboardingStore";
import { SUPPORTED_GAMES, GAME_ROLES, BEHAVIOR_QUESTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Users, Brain, CheckCircle2, Loader2 } from "lucide-react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/useAuthStore";

type Step = "game" | "role" | "behavior" | "complete";

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("game");
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(true);
  const supabase = createSupabaseClient();
  const { user, loading: authLoading } = useAuthStore();

  const {
    selectedGame,
    selectedRole,
    behaviorAnswers,
    personalityTags,
    setSelectedGame,
    setSelectedRole,
    setBehaviorAnswer,
    calculatePersonalityTags,
  } = useOnboardingStore();

  // Check if email is confirmed and if onboarding is already completed
  useEffect(() => {
    const checkEmailConfirmation = async () => {
      if (authLoading) return; // Wait for auth to load
      if (!user) {
        router.push("/auth/login");
        return;
      }

      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          router.push("/auth/login");
          return;
        }

        // Check if email is confirmed
        if (!currentUser.email_confirmed_at) {
          // Email not confirmed, redirect to verification page
          router.push("/auth/verify-email");
          return;
        }

        // Check if user has already completed onboarding (has user_game_profile or personality data)
        const [{ data: gameProfiles }, { data: profile }] = await Promise.all([
          supabase
            .from("user_game_profiles")
            .select("id")
            .eq("user_id", user.id)
            .limit(1),
          supabase
            .from("profiles")
            .select("personality_tags, play_style")
            .eq("id", user.id)
            .single(),
        ]);

        const hasGameProfile = (gameProfiles?.length || 0) > 0;
        const hasAnsweredQuestions =
          (profile?.personality_tags?.length || 0) > 0 && !!profile?.play_style;

        // If onboarding is already completed, redirect to swipe
        // Only allow onboarding if explicitly requested (e.g., changing game from profile)
        const urlParams = new URLSearchParams(window.location.search);
        const allowOnboarding = urlParams.get("change_game") === "true";

        if ((hasGameProfile || hasAnsweredQuestions) && !allowOnboarding) {
          router.push("/swipe");
          return;
        }

        setCheckingEmail(false);
      } catch (error) {
        console.error("Error checking email:", error);
        router.push("/auth/login");
      }
    };

    checkEmailConfirmation();
  }, [user, router, supabase]);

  const handleGameSelect = (gameId: string) => {
    setSelectedGame(gameId);
    setCurrentStep("role");
  };

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setCurrentStep("behavior");
  };

  const handleBehaviorAnswer = (questionId: string, answer: string) => {
    setBehaviorAnswer(questionId, answer);
  };

  const handleComplete = async () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    // Calculate tags before saving
    calculatePersonalityTags();

    setLoading(true);

    try {
      // Get game data
      const game = SUPPORTED_GAMES.find((g) => g.id === selectedGame);
      if (!game) throw new Error("Game not found");

      // Calculate tags
      calculatePersonalityTags();
      const calculatedTags = useOnboardingStore.getState().personalityTags;

      // Update profile with onboarding data
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          personality_tags: calculatedTags.length > 0 ? calculatedTags : ["Chill"],
          play_style: behaviorAnswers.play_style === "tryhard" ? "Competitive" : "Casual",
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Create user_game_profile
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("id")
        .eq("slug", game.slug)
        .single();

      if (gameError) throw gameError;

      // If changing game, update existing profile, otherwise create new
      const urlParams = new URLSearchParams(window.location.search);
      const isChangingGame = urlParams.get("change_game") === "true";

      if (isChangingGame) {
        // Update existing game profile
        const { error: gameProfileError } = await supabase
          .from("user_game_profiles")
          .update({
            game_id: gameData.id,
            role: selectedRole || null,
          })
          .eq("user_id", user.id);

        if (gameProfileError) throw gameProfileError;
      } else {
        // Create new game profile
        const { error: gameProfileError } = await supabase
          .from("user_game_profiles")
          .upsert({
            user_id: user.id,
            game_id: gameData.id,
            role: selectedRole || null,
          });

        if (gameProfileError) throw gameProfileError;
      }

      setCurrentStep("complete");
      setTimeout(() => {
        router.push("/swipe");
      }, 2000);
    } catch (error) {
      console.error("Onboarding error:", error);
      alert("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const canProceedToBehavior = () => {
    return Object.keys(behaviorAnswers).length === BEHAVIOR_QUESTIONS.length;
  };

  const renderGameSelection = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Gamepad2 className="w-16 h-16 mx-auto text-neon-purple" />
        <h2 className="text-3xl font-bold font-gaming">Hangi Oyunu Oynuyorsun?</h2>
        <p className="text-muted-foreground">Ana oyununu seç</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SUPPORTED_GAMES.map((game) => (
          <Card
            key={game.id}
            className={`cursor-pointer transition-all hover:border-neon-purple hover:neon-glow-purple ${
              selectedGame === game.id ? "border-neon-purple neon-glow-purple" : ""
            }`}
            onClick={() => handleGameSelect(game.id)}
          >
            <CardHeader>
              <CardTitle className="text-xl">{game.name}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderRoleSelection = () => {
    if (!selectedGame) return null;
    const roles = GAME_ROLES[selectedGame as keyof typeof GAME_ROLES] || [];

    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <Users className="w-16 h-16 mx-auto text-neon-green" />
          <h2 className="text-3xl font-bold font-gaming">Hangi Rolü Oynuyorsun?</h2>
          <p className="text-muted-foreground">Ana rolünü seç</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {roles.map((role) => (
            <Button
              key={role}
              variant={selectedRole === role ? "neonGreen" : "outline"}
              size="lg"
              className="h-20 text-lg"
              onClick={() => handleRoleSelect(role)}
            >
              {role}
            </Button>
          ))}
        </div>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => setCurrentStep("game")}>
            Geri
          </Button>
        </div>
      </div>
    );
  };

  const renderBehaviorTest = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Brain className="w-16 h-16 mx-auto text-neon-purple" />
        <h2 className="text-3xl font-bold font-gaming">Oyun Karakterin</h2>
        <p className="text-muted-foreground">Birkaç soru daha, seni daha iyi eşleştirelim</p>
      </div>
      <div className="space-y-8">
        {BEHAVIOR_QUESTIONS.map((question) => (
          <Card key={question.id} className="border-2">
            <CardHeader>
              <CardTitle className="text-xl">{question.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {question.options.map((option) => (
                  <Button
                    key={option.value}
                    variant={
                      behaviorAnswers[question.id] === option.value ? "neon" : "outline"
                    }
                    className="w-full justify-start h-auto py-4 px-6 text-left"
                    onClick={() => handleBehaviorAnswer(question.id, option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex gap-4 justify-center">
        <Button variant="outline" onClick={() => setCurrentStep("role")}>
          Geri
        </Button>
        <Button
          variant="neon"
          size="lg"
          onClick={handleComplete}
          disabled={!canProceedToBehavior() || loading}
        >
          {loading ? "Kaydediliyor..." : "Tamamla"}
        </Button>
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="text-center space-y-6">
      <CheckCircle2 className="w-24 h-24 mx-auto text-neon-green" />
      <h2 className="text-4xl font-bold font-gaming">Hoş Geldin!</h2>
      <p className="text-xl text-muted-foreground">
        Profilin hazır. Eşleşmelere başlayabilirsin!
      </p>
    </div>
  );

  if (checkingEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <Card className="border-2 border-neon-purple/20">
          <CardContent className="p-8">
            {currentStep === "game" && renderGameSelection()}
            {currentStep === "role" && renderRoleSelection()}
            {currentStep === "behavior" && renderBehaviorTest()}
            {currentStep === "complete" && renderComplete()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

