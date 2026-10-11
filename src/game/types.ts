// What the app as a whole is made of: its pages, and the things that open over or beside them

// The pages of the site
export type Route = "game" | "multiplayer" | "daily" | "leaderboard" | "history" | "admin"

// What the left pane can show in place of the navigation
export type Panel = "themes" | "settings" | "help" | "chat"

// Which form the account window shows to a signed-out player
export type AuthMode = "signIn" | "signUp"
