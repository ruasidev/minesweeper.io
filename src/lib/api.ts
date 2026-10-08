import { API_URL } from "./authClient"
import type { BadgeId } from "../../shared/badges"
import type { BoardSettings, RoomSummary } from "../../shared/protocol"

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
}

// A singleplayer game that was started, and how it ended: "abandoned" is a game reset part-way through
export type GameResult = {
  rows: number
  cols: number
  mines: number
  outcome: "won" | "lost" | "abandoned"
  durationSeconds: number
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
  gamesPlayed: number
  signInMethods: string[]
}

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
export const recordGame = (result: GameResult) => request<{ ok: true }>("/games", { method: "POST", body: result })
// Admins only. At most the newest 100 matches come back; `total` is how many there are altogether
export const getAdminUsers = (search: string) =>
  request<{ users: AdminUser[], total: number }>(`/admin/users?search=${encodeURIComponent(search)}`)
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
