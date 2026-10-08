// The badges a profile can carry. The server works out which ones a player has earned; the site knows how
// each one looks. Imported by both sides, so this file must not import anything else
export const BADGES = [
  // given, not earned: it only shows up among the possible badges for someone who has it
  { id: "admin", name: "Admin", description: "Helps run the game", given: true },
  { id: "early-supporter", name: "Early supporter", description: "Joined while the game was still in beta" },
  { id: "expert", name: "Expert", description: "Cleared an Expert board in multiplayer" },
  { id: "flawless", name: "Flawless", description: "Cleared an Intermediate or Expert board in multiplayer without hitting a mine" },
  { id: "lightning", name: "Lightning", description: "Cleared an Intermediate board in multiplayer in under a minute" },
  { id: "daily-devotee", name: "Daily devotee", description: "Cleared 7 daily challenges" },
  { id: "veteran", name: "Veteran", description: "Played 100 singleplayer games" },
  { id: "bomb-magnet", name: "Bomb magnet", description: "Hit 25 mines across finished multiplayer games" },
] as const satisfies readonly { id: string, name: string, description: string, given?: boolean }[]

export type BadgeId = typeof BADGES[number]["id"]
