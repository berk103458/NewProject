import { create } from "zustand";

export interface UserCard {
  id: string;
  username: string;
  avatar_url: string | null;
  riot_id: string | null;
  rank: string | null;
  role: string | null;
  personality_tags: string[];
  play_style: "Competitive" | "Casual";
  bio: string | null;
  toxicity_score: number;
}

interface SwipeState {
  currentUsers: UserCard[];
  currentIndex: number;
  swipedUsers: Set<string>;
  setCurrentUsers: (users: UserCard[]) => void;
  swipeUser: (userId: string, direction: "left" | "right") => void;
  nextUser: () => void;
  reset: () => void;
}

export const useSwipeStore = create<SwipeState>((set, get) => ({
  currentUsers: [],
  currentIndex: 0,
  swipedUsers: new Set(),

  setCurrentUsers: (users) => set({ currentUsers: users, currentIndex: 0 }),

  swipeUser: (userId, direction) => {
    const { swipedUsers } = get();
    swipedUsers.add(userId);
    set({ swipedUsers: new Set(swipedUsers) });
  },

  nextUser: () => {
    const { currentIndex, currentUsers } = get();
    if (currentIndex < currentUsers.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  reset: () => set({ currentUsers: [], currentIndex: 0, swipedUsers: new Set() }),
}));

