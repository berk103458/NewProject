"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, Users, User, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";

export function Navigation() {
  // Keep auth session hydrated globally
  useAuth();

  const pathname = usePathname();

  const navItems = [
    { href: "/swipe", label: "Eşleş", icon: Users },
    { href: "/matches", label: "Eşleşmeler", icon: Heart },
    { href: "/profile", label: "Profil", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-around p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full",
                  isActive && "bg-neon-purple/20 text-neon-purple"
                )}
              >
                <Icon className="w-5 h-5" />
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

