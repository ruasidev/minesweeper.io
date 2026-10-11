// The room a visitor asked to join before they had an account. Signing up takes a moment and a window of its own;
// when they come out of it signed in, they are taken to the room they were after rather than back to the list.
// Kept for this tab only, and not for long: an old wish to join a room isn't acted on hours later

const KEY = "roomToJoin"
const KEPT_FOR_MS = 10 * 60 * 1000

export function rememberRoomToJoin(roomId: string, now = Date.now()): void {
  sessionStorage.setItem(KEY, JSON.stringify({ roomId, at: now }))
}

// The room that was asked for, if it was asked for lately. It is forgotten in the asking: it is joined once
export function takeRoomToJoin(now = Date.now()): string | null {
  const kept = sessionStorage.getItem(KEY)
  sessionStorage.removeItem(KEY)
  if (!kept) return null
  try {
    const { roomId, at } = JSON.parse(kept) as { roomId?: unknown, at?: unknown }
    return typeof roomId === "string" && typeof at === "number" && now - at >= 0 && now - at < KEPT_FOR_MS ? roomId : null
  } catch {
    return null
  }
}
