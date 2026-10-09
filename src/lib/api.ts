import { API_URL } from "./authClient"
import type { BadgeId } from "../../shared/badges"
import type { BoardSettings, Move, RoomSummary } from "../../shared/protocol"

export type BestTime = {
  rows: number
  cols: number
  mines: number
  seconds: number
}

export type Profile = {
  username: string
  bio: string
  badges: BadgeId[]
  // experience (their level comes from this), multiplayer rating, and how much they have played
  xp: number
  elo: number
  gamesStarted: number
  playSeconds: number
  joinedAt: string
  stats: {
    gamesPlayed: number
    wins: number
    bestTimes: BestTime[]
  }
  // Whether their email address is confirmed. "off" while the site sends no email at all, and nothing depends on it.
  // Until it is confirmed their games don't count towards ratings
  email: "off" | "confirmed" | "unconfirmed"
}

// A player's profile as any other player sees it
export type PlayerProfile = {
  id: string
  // their display name
  name: string
  username: string
  bio: string
  badges: BadgeId[]
  xp: number
  elo: number
  gamesStarted: number
  playSeconds: number
  image: string | null
  isAdmin: boolean
  joinedAt: string
  stats: Profile["stats"]
}

// An account as the admin screen lists it
export type AdminUser = {
  id: string
  name: string
  // null until the account's profile has been opened once
  username: string | null
  email: string
  image: string | null
  role: string | null
  createdAt: string
  emailVerified: boolean
  banned: boolean
  banReason: string | null
  // null until the account's profile has been opened once
  elo: number | null
  gamesPlayed: number
  signInMethods: string[]
}

// A game that was too fast to have been a person playing, as an admin sees it
export type SuspectGame = {
  id: number
  userId: string
  username: string
  kind: "singleplayer" | "multiplayer" | "daily"
  rows: number
  cols: number
  mines: number
  durationMs: number
  // the fewest clicks the board could be cleared in
  clicksNeeded: number
  moves: number
  reason: string | null
  at: string
}

// Whose results, on which board, to take off the leaderboards or put back
export type ScoreSelection =
  | { kind: "singleplayer" | "multiplayer", userId: string, rows: number, cols: number, mines: number }
  | { kind: "daily", userId: string, date: string }

// Calls the API as the signed-in player. Throws an Error carrying the server's message when it refuses.
// A file is sent as it is, anything else as JSON
async function request<T>(path: string, options?: { method: string, body: unknown }): Promise<T> {
  const file = options?.body instanceof Blob ? options.body : null
  const response = await fetch(`${API_URL}/api${path}`, {
    method: options?.method,
    credentials: "include",
    headers: options ? { "Content-Type": file ? file.type : "application/json" } : undefined,
    body: options ? file ?? JSON.stringify(options.body) : undefined,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? "Couldn't reach the server")
  return data as T
}

export const getProfile = () => request<Profile>("/profile")
export const getPlayerProfile = (playerId: string) => request<PlayerProfile>(`/profiles/${encodeURIComponent(playerId)}`)
export const updateUsername = (username: string) => request<Profile>("/profile", { method: "PATCH", body: { username } })
export const updateBio = (bio: string) => request<Profile>("/profile", { method: "PATCH", body: { bio } })
// resolves to where the new photo can be loaded from
export const uploadAvatar = (image: Blob) => request<{ image: string }>("/profile/avatar", { method: "PUT", body: image })
// Admins only. At most the newest 100 matches come back; `total` is how many there are altogether
export const getAdminUsers = (search: string) =>
  request<{ users: AdminUser[], total: number }>(`/admin/users?search=${encodeURIComponent(search)}`)
export const resetRating = (userId: string) =>
  request<{ ok: true }>(`/admin/users/${encodeURIComponent(userId)}/reset-rating`, { method: "POST", body: {} })
export const setBanned = (userId: string, banned: boolean, reason?: string) =>
  request<{ ok: true }>(`/admin/users/${encodeURIComponent(userId)}/ban`, { method: "POST", body: { banned, reason } })
export const setScoresHidden = (scores: ScoreSelection, hidden: boolean) =>
  request<{ ok: true }>("/admin/scores/visibility", { method: "POST", body: { ...scores, hidden } })
export const getSuspectGames = () => request<{ games: SuspectGame[] }>("/admin/suspect-games")
// One game in someone's match history
export type HistoryGame = {
  id: number
  kind: "singleplayer" | "multiplayer" | "daily"
  // whether it counted towards ratings
  rated: boolean
  rows: number
  cols: number
  mines: number
  // how it ended for the player: a PlayerOutcome, or "abandoned" for a singleplayer game thrown away
  outcome: string
  durationMs: number
  mineHits: number
  // A multiplayer game: where they came, out of how many, and how far it moved their rating (null where ratings
  // didn't move). All null for any other kind of game, and for multiplayer games from before these were kept
  place: number | null
  players: number | null
  ratingChange: number | null
  // how many moves they made
  moves: number
  at: string
}

// A recorded game in full, for playing back: the board it was played on and every move
export type RecordedGame = Omit<HistoryGame, "moves" | "place" | "players" | "ratingChange"> & {
  userId: string
  username: string
  image: string | null
  // where the mines were: one character per cell, row after row, "1" for a mine
  layout: string
  // the cell the board was opened on
  openRow: number
  openCol: number
  moves: Move[]
}

// A page of a player's match history, newest first. `before` is the id of the last game already shown
export const getHistory = (userId: string, before?: number) =>
  request<{ player: { id: string, username: string, image: string | null }, games: HistoryGame[], more: boolean }>(
    `/history/${encodeURIComponent(userId)}${before ? `?before=${before}` : ""}`)
export const getRecordedGame = (id: number) => request<RecordedGame>(`/replays/${id}`)
// The rooms that are open right now. Anyone can ask, signed in or not
export const getOpenRooms = () => request<{ rooms: RoomSummary[] }>("/rooms")

// One place on a leaderboard
export type ScoreEntry = {
  userId: string
  username: string
  image: string | null
  durationMs: number
  mineHits: number
  // when it was set
  at: string
}

// Today's challenge: the board, who has cleared it, and how the signed-in player's own go stands
export type DailyInfo = {
  // YYYY-MM-DD, the server's day
  date: string
  settings: BoardSettings
  entries: ScoreEntry[]
  // null if they haven't started today or aren't signed in; durationMs is null until they have cleared it
  mine: { startedAt: string, durationMs: number | null, mineHits: number | null } | null
}

// Each player's fastest clear of one of the classic boards, in one mode. `board` is a BOARD_PRESETS id
export const getLeaderboard = (board: string, mode: "singleplayer" | "multiplayer") =>
  request<{ entries: ScoreEntry[] }>(`/leaderboard/${board}?mode=${mode}`)
export const getDaily = () => request<DailyInfo>("/daily")
