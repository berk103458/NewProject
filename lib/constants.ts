// Game constants
export const SUPPORTED_GAMES = [
  { id: "lol", name: "League of Legends", slug: "lol" },
  { id: "valorant", name: "Valorant", slug: "valorant" },
  { id: "cs2", name: "Counter-Strike 2", slug: "cs2" },
] as const;

// Role constants
export const GAME_ROLES = {
  lol: ["Top", "Jungle", "Mid", "ADC", "Support"],
  valorant: ["Duelist", "Initiator", "Controller", "Sentinel"],
  cs2: ["Entry", "Lurker", "Support", "AWPer", "IGL"],
} as const;

// Personality tags
export const PERSONALITY_TAGS = [
  "Tryhard",
  "Chill",
  "Leader",
  "Supportive",
  "Shotcaller",
  "Toxic_Prone",
  "Tilt_Resistant",
] as const;

// Play styles
export const PLAY_STYLES = ["Competitive", "Casual"] as const;

// Behavior test questions
export const BEHAVIOR_QUESTIONS = [
  {
    id: "team_behind",
    question: "Takımın 0-5 geride, ne yaparsın?",
    options: [
      { value: "ff", label: "FF veririm", tags: ["Toxic_Prone"] },
      { value: "motivate", label: "Motive ederim", tags: ["Leader", "Supportive"] },
      { value: "mute", label: "Sessize alırım", tags: ["Chill", "Tilt_Resistant"] },
      { value: "tryhard", label: "Daha çok tryhard yaparım", tags: ["Tryhard"] },
    ],
  },
  {
    id: "play_style",
    question: "Oyun stilin nedir?",
    options: [
      { value: "tryhard", label: "Tryhard kazanmak", tags: ["Tryhard"] },
      { value: "fun", label: "Eğlencesine makara", tags: ["Chill"] },
      { value: "task", label: "Sadece görev yaparım", tags: ["Supportive"] },
    ],
  },
  {
    id: "communication",
    question: "Oyun sırasında iletişim tarzın?",
    options: [
      { value: "shotcall", label: "Shotcall yaparım, komut veririm", tags: ["Shotcaller", "Leader"] },
      { value: "follow", label: "Komutlara uyarım", tags: ["Supportive"] },
      { value: "quiet", label: "Sessiz oynarım, nadiren konuşurum", tags: ["Chill"] },
      { value: "toxic", label: "Takımı eleştiririm", tags: ["Toxic_Prone"] },
    ],
  },
  {
    id: "tilt_response",
    question: "Oyunda kötü gidince ne yaparsın?",
    options: [
      { value: "calm", label: "Sakin kalırım, devam ederim", tags: ["Tilt_Resistant", "Chill"] },
      { value: "rage", label: "Sinirlenirim, oyunu bırakırım", tags: ["Toxic_Prone"] },
      { value: "analyze", label: "Hataları analiz eder, düzeltirim", tags: ["Tryhard", "Leader"] },
      { value: "blame", label: "Takım arkadaşlarını suçlarım", tags: ["Toxic_Prone"] },
    ],
  },
  {
    id: "team_role",
    question: "Takımda hangi rolü üstlenirsin?",
    options: [
      { value: "leader", label: "Liderlik yaparım", tags: ["Leader", "Shotcaller"] },
      { value: "support", label: "Destekleyiciyim", tags: ["Supportive"] },
      { value: "solo", label: "Bireysel oynarım", tags: ["Chill"] },
      { value: "carry", label: "Takımı taşırım", tags: ["Tryhard"] },
    ],
  },
  {
    id: "rank_priority",
    question: "Rank için ne kadar önem verirsin?",
    options: [
      { value: "very_important", label: "Çok önemli, her oyunu kazanmak isterim", tags: ["Tryhard"] },
      { value: "important", label: "Önemli ama eğlence de önemli", tags: ["Chill"] },
      { value: "not_important", label: "Önemli değil, eğlenmek öncelik", tags: ["Chill"] },
    ],
  },
  {
    id: "time_commitment",
    question: "Ne kadar süre oyun oynayabilirsin?",
    options: [
      { value: "long", label: "Uzun süre (3+ saat)", tags: ["Tryhard"] },
      { value: "medium", label: "Orta süre (1-3 saat)", tags: ["Chill"] },
      { value: "short", label: "Kısa süre (1 saat altı)", tags: ["Chill"] },
    ],
  },
] as const;

export type BehaviorQuestion = typeof BEHAVIOR_QUESTIONS[number];

