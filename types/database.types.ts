export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          discord_id: string | null;
          bio: string | null;
          avatar_url: string | null;
          riot_id: string | null;
          personality_tags: string[];
          play_style: "Competitive" | "Casual";
          toxicity_score: number;
          user_points: number;
          wallet_balance: number;
          credits: number;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          discord_id?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          riot_id?: string | null;
          personality_tags?: string[];
          play_style?: "Competitive" | "Casual";
          toxicity_score?: number;
          user_points?: number;
          wallet_balance?: number;
          credits?: number;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          discord_id?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          riot_id?: string | null;
          personality_tags?: string[];
          play_style?: "Competitive" | "Casual";
          toxicity_score?: number;
          user_points?: number;
          wallet_balance?: number;
          credits?: number;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          name: string;
          slug: string;
          rank_system: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          rank_system?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          rank_system?: Json;
          created_at?: string;
        };
      };
      matches: {
        Row: {
          id: string;
          user_id_1: string;
          user_id_2: string;
          status: "pending" | "matched" | "rejected";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id_1: string;
          user_id_2: string;
          status?: "pending" | "matched" | "rejected";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id_1?: string;
          user_id_2?: string;
          status?: "pending" | "matched" | "rejected";
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          match_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          sender_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          sender_id?: string;
          content?: string;
          created_at?: string;
        };
      };
    };
  };
}

