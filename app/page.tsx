"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Gamepad2, Heart, Shield, Users, Sparkles, CheckCircle2, Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-black/40 text-foreground">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 blur-3xl bg-[radial-gradient(circle_at_20%_20%,#8b5cf6,transparent_25%),radial-gradient(circle_at_80%_0%,#22d3ee,transparent_25%),radial-gradient(circle_at_50%_80%,#22c55e,transparent_20%)]" />

        {/* Hero */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-16 lg:pt-28 lg:pb-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-card/60 border border-neon-purple/30 px-4 py-2 text-sm text-neon-purple">
                <Sparkles className="w-4 h-4" />
                Anti-toxic matchmaking
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight font-gaming">
                <span className="text-neon-purple">Gamer</span>
                <span className="text-neon-green">Match</span> ile gerçek oyun
                partnerini bul
              </h1>
              <p className="text-lg text-muted-foreground">
                Kişilik ve oyun stili bazlı eşleşme, toxicity skoru filtreleme, güvenli sohbet ve Riot istatistikleriyle destekli swipe deneyimi.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" variant="neon" className="px-8">
                  <Link href="/auth/signup">Hemen Başla</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="px-8">
                  <Link href="/auth/login">Giriş Yap</Link>
                </Button>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-neon-green" />
                  Anti-toxic filtre
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-neon-green" />
                  Gerçek oyun verisi
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-neon-green" />
                  Anlık swipe
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-to-br from-neon-purple/20 via-transparent to-neon-green/30 blur-3xl" />
              <div className="relative rounded-2xl border border-neon-purple/20 bg-card/70 shadow-2xl backdrop-blur">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-purple to-neon-green flex items-center justify-center">
                      <Gamepad2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Örnek eşleşme</p>
                      <p className="font-semibold">valorant • duelist</p>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-neon-green/20 text-neon-green border border-neon-green/30">
                    Anti-toxic
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-background/60 border border-border">
                      <p className="text-sm text-muted-foreground">Kişilik</p>
                      <p className="text-lg font-semibold">Chill • Team Player</p>
                    </div>
                    <div className="p-4 rounded-xl bg-background/60 border border-border">
                      <p className="text-sm text-muted-foreground">Rol & Rank</p>
                      <p className="text-lg font-semibold">Duelist • Diamond</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-background/60 border border-border p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Toxicity Score</p>
                      <p className="text-lg font-semibold text-neon-green">Düşük</p>
                    </div>
                    <div className="flex gap-3">
                      <Button size="icon" variant="destructive" className="rounded-full">
                        <Heart className="w-5 h-5 rotate-45" />
                      </Button>
                      <Button size="icon" variant="neonGreen" className="rounded-full">
                        <Heart className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Shield className="w-8 h-8 text-neon-green" />,
                title: "Anti-Toxic Filtre",
                desc: "Rapor geçmişi ve toxicity skoru ile güvenilir oyuncularla eşleş.",
              },
              {
                icon: <Users className="w-8 h-8 text-neon-purple" />,
                title: "Gerçek Oyun Verisi",
                desc: "Riot istatistikleri, rol, rank ve oyun stiliyle eşleşme kalitesini artır.",
              },
              {
                icon: <Heart className="w-8 h-8 text-neon-green" />,
                title: "Swipe & Match",
                desc: "Hızlı swipe, anlık eşleşme ve güvenli sohbet akışı.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-6 rounded-2xl border border-neon-purple/20 bg-card/70 backdrop-blur shadow-lg space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-background/60 border border-border flex items-center justify-center">
                  {item.icon}
                </div>
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
          <div className="rounded-3xl border border-neon-green/20 bg-card/60 backdrop-blur p-8 shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-neon-green" />
              <h2 className="text-2xl font-bold">Nasıl Çalışır?</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { step: "1", title: "Profilini oluştur", desc: "Kişilik sorularını cevapla, oyununu ve rolünü seç." },
                { step: "2", title: "Anti-toxic filtre", desc: "Düşük toxicity skoru ve benzer oyun stili olanları gör." },
                { step: "3", title: "Swipe & eşleş", desc: "Beğen, eşleş ve uygulama içi sohbetle oyuna atıl." },
              ].map((item) => (
                <div key={item.step} className="p-5 rounded-2xl border border-border bg-background/60 space-y-2">
                  <div className="w-10 h-10 rounded-full border border-neon-purple/40 text-neon-purple flex items-center justify-center font-semibold">
                    {item.step}
                  </div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="neon" size="lg">
                <Link href="/auth/signup">Kayıt Ol</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/login">Giriş Yap</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

