"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { UserCard as UserCardType } from "@/lib/store/useSwipeStore";
import { Trophy, Shield, Heart, X, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserCardProps {
  user: UserCardType;
  onSwipe: (direction: "left" | "right") => void;
  offset?: { x: number; y: number };
  rotation?: number;
}

export function UserCard({ user, onSwipe, offset = { x: 0, y: 0 }, rotation = 0 }: UserCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const likeOpacity = Math.min(Math.max(offset.x, 0) / 120, 1);
  const nopeOpacity = Math.min(Math.max(-offset.x, 0) / 120, 1);
  const cardScale = isDragging ? 1.02 : 1;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;

    if (Math.abs(deltaX) > 50) {
      onSwipe(deltaX > 0 ? "right" : "left");
      setIsDragging(false);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getPersonalitySummary = () => {
    const tags = user.personality_tags;
    if (tags.includes("Tryhard") && tags.includes("Tilt_Resistant")) {
      return "Agresif Entry ama Tilt Olmaz";
    }
    if (tags.includes("Chill") && tags.includes("Supportive")) {
      return "Rahat ve Destekleyici";
    }
    if (tags.includes("Leader") && tags.includes("Shotcaller")) {
      return "Doğal Lider ve Shotcaller";
    }
    if (tags.includes("Tryhard")) {
      return "Kazanmak İçin Tryhard";
    }
    if (tags.includes("Chill")) {
      return "Eğlencesine Oynar";
    }
    return "Dengeli Oyun Tarzı";
  };

  const getToxicityColor = () => {
    if (user.toxicity_score < 20) return "text-neon-green";
    if (user.toxicity_score < 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div
      className="absolute w-full h-full cursor-grab active:cursor-grabbing"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${cardScale})`,
        transition: isDragging ? "none" : "transform 0.25s ease-out",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Card className="h-full border-2 border-neon-purple/40 bg-gradient-to-br from-[#0b0b1a] via-[#0f0f25] to-[#0b0b1a] backdrop-blur-md shadow-[0_20px_60px_-25px_rgba(124,58,237,0.6)]">
        <CardContent className="p-6 h-full flex flex-col relative">
          {/* Avatar Section */}
          <div className="relative mb-4">
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-neon-purple to-neon-green flex items-center justify-center text-4xl font-bold border-[3px] border-neon-purple shadow-[0_0_25px_-8px_rgba(124,58,237,0.8)] overflow-hidden">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.username}
                  width={128}
                  height={128}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>{user.username.charAt(0).toUpperCase()}</span>
              )}
            </div>
            {user.toxicity_score < 20 && (
              <div className="absolute top-0 right-0 bg-neon-green rounded-full p-1">
                <Shield className="w-4 h-4 text-black" />
              </div>
            )}
          </div>

          {/* Username & Riot ID */}
          <div className="text-center mb-4 space-y-1">
            <h2 className="text-2xl font-bold font-gaming text-neon-purple mb-1">
              {user.username}
            </h2>
            {user.riot_id && (
              <p className="text-muted-foreground text-sm">#{user.riot_id}</p>
            )}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Gamepad2 className="w-4 h-4 text-neon-green" />
              <span className="uppercase tracking-wide text-neon-green/90">{user.role || "Gamer"}</span>
            </div>
          </div>

          {/* Rank & Role */}
          <div className="flex items-center justify-center gap-4 mb-4">
            {user.rank && (
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="w-4 h-4 text-neon-green" />
                <span className="font-semibold">{user.rank}</span>
              </div>
            )}
            {user.role && (
              <div className="flex items-center gap-2 text-sm">
                <Gamepad2 className="w-4 h-4 text-neon-purple" />
                <span className="font-semibold">{user.role}</span>
              </div>
            )}
          </div>

          {/* Personality Summary */}
          <div className="bg-black/40 rounded-lg p-4 mb-4 text-center border border-neon-purple/30">
            <p className="text-sm font-semibold text-neon-green mb-2">Oyun Karakteri</p>
            <p className="text-xs text-muted-foreground">{getPersonalitySummary()}</p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {user.personality_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs rounded-full bg-neon-purple/15 text-neon-purple border border-neon-purple/30 shadow-[0_0_12px_-8px_rgba(124,58,237,0.8)]"
              >
                {tag.replace("_", " ")}
              </span>
            ))}
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="flex-1 overflow-y-auto mb-4">
              <p className="text-sm text-muted-foreground text-center">{user.bio}</p>
            </div>
          )}

          {/* Toxicity Score (Hidden but shown for debugging) */}
          <div className="text-center">
            <div className={cn("text-xs font-semibold", getToxicityColor())}>
              Güvenilirlik: {100 - user.toxicity_score}%
            </div>
          </div>

          {/* Swipe Indicators */}
          <div
            className="absolute top-6 left-4 px-3 py-2 rounded-lg border-2 border-red-400/80 bg-black/70 backdrop-blur text-red-400 font-bold uppercase tracking-wide flex items-center gap-2"
            style={{ opacity: nopeOpacity, transform: "rotate(-12deg)" }}
          >
            <X className="w-4 h-4" />
            Nope
          </div>
          <div
            className="absolute top-6 right-4 px-3 py-2 rounded-lg border-2 border-neon-green/80 bg-black/70 backdrop-blur text-neon-green font-bold uppercase tracking-wide flex items-center gap-2"
            style={{ opacity: likeOpacity, transform: "rotate(12deg)" }}
          >
            <Heart className="w-4 h-4" />
            Like
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

