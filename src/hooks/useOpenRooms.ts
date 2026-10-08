import { useEffect, useState } from "react"
import { getOpenRooms } from "../lib/api"
import type { RoomSummary } from "../../shared/protocol"

// How often the list is fetched again
const REFRESH_MS = 10_000

// The multiplayer rooms that are open right now, kept fresh for as long as the component using it is on screen.
// Anyone can see them, signed in or not. Null until the first answer, and stays null if the server can't be reached
export function useOpenRooms(): RoomSummary[] | null {
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => getOpenRooms()
      .then(({ rooms }) => { if (!cancelled) setRooms(rooms) })
      .catch(() => {})
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return rooms
}
