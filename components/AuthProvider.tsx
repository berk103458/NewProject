"use client";

import { useAuth } from "@/lib/hooks/useAuth";

export default function AuthProvider() {
  // Keeps Supabase session in Zustand across refresh/navigation
  useAuth();
  return null;
}

