import { API_URL } from "./authClient"

export type BestTime = {
  rows: number
  cols: number
  mines: number
  seconds: number
}

export type Profile = {
  username: string
  joinedAt: string
  stats: {
    gamesPlayed: number
    wins: number
    bestTimes: BestTime[]
  }
}

export type GameResult = {
  rows: number
  cols: number
  mines: number
  won: boolean
  durationSeconds: number
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
export const updateUsername = (username: string) => request<Profile>("/profile", { method: "PATCH", body: { username } })
// resolves to where the new photo can be loaded from
export const uploadAvatar = (image: Blob) => request<{ image: string }>("/profile/avatar", { method: "PUT", body: image })
export const recordGame = (result: GameResult) => request<{ ok: true }>("/games", { method: "POST", body: result })
// Admins only. At most the newest 100 matches come back; `total` is how many there are altogether
export const getAdminUsers = (search: string) =>
  request<{ users: AdminUser[], total: number }>(`/admin/users?search=${encodeURIComponent(search)}`)
