import { create } from "zustand";
import { BEHAVIOR_QUESTIONS } from "@/lib/constants";

export interface OnboardingState {
  // Step 1: Game Selection
  selectedGame: string | null;
  setSelectedGame: (game: string) => void;

  // Step 2: Role Selection
  selectedRole: string | null;
  setSelectedRole: (role: string) => void;

  // Step 3: Behavior Test Answers
  behaviorAnswers: Record<string, string>;
  setBehaviorAnswer: (questionId: string, answer: string) => void;

  // Calculated personality tags
  personalityTags: string[];
  calculatePersonalityTags: () => void;

  // Reset function
  reset: () => void;
}

const initialState = {
  selectedGame: null,
  selectedRole: null,
  behaviorAnswers: {},
  personalityTags: [],
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialState,

  setSelectedGame: (game) => set({ selectedGame: game }),

  setSelectedRole: (role) => set({ selectedRole: role }),

  setBehaviorAnswer: (questionId, answer) =>
    set((state) => ({
      behaviorAnswers: {
        ...state.behaviorAnswers,
        [questionId]: answer,
      },
    })),

  calculatePersonalityTags: () => {
    const { behaviorAnswers } = get();
    const tags = new Set<string>();

    // Analyze answers and assign tags
    Object.entries(behaviorAnswers).forEach(([questionId, answer]) => {
      // Find the question and its options
      const question = BEHAVIOR_QUESTIONS.find((q) => q.id === questionId);
      if (question) {
        const option = question.options.find((opt) => opt.value === answer);
        if (option) {
          option.tags.forEach((tag) => tags.add(tag));
        }
      }
    });

    set({ personalityTags: Array.from(tags) });
  },

  reset: () => set(initialState),
}));

