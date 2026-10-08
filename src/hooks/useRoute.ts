import { useEffect, useState } from "react"
import type { Route } from "../game/types"

// The site is served as plain files with no server to map addresses to pages,
// so which page is showing lives in the part of the address after the #
const HASHES: Record<Route, string> = {
  game: "#/",
  multiplayer: "#/multiplayer",
  daily: "#/daily",
  leaderboard: "#/leaderboard",
  admin: "#/admin",
}
// in the order they come in the navigation
export const ROUTES = Object.keys(HASHES) as Route[]

const currentRoute = (): Route => ROUTES.find(route => HASHES[route] === window.location.hash) ?? "game"

export function useRoute() {
  const [route, setRoute] = useState<Route>(currentRoute)

  useEffect(() => {
    const handleChange = () => setRoute(currentRoute())
    window.addEventListener("hashchange", handleChange)
    return () => window.removeEventListener("hashchange", handleChange)
  }, [])

  const navigate = (to: Route) => {
    window.location.hash = HASHES[to]
  }

  return { route, navigate }
}
