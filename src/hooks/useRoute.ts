import { useEffect, useState } from "react"
import type { Route } from "../game/types"

// The site is served as plain files with no server to map addresses to pages,
// so which page is showing lives in the part of the address after the #
const HASHES: Record<Route, string> = {
  game: "#/",
  multiplayer: "#/multiplayer",
  daily: "#/daily",
  training: "#/training",
  leaderboard: "#/leaderboard",
  history: "#/history",
  admin: "#/admin",
}
// in the order they come in the navigation
export const ROUTES = Object.keys(HASHES) as Route[]

// Where a page's address is followed by more, that is what the page is to show: "#/history/<player>/<game>",
// "#/training/patterns"
function current(): { route: Route, params: string[] } {
  const [page = "", ...rest] = window.location.hash.replace(/^#\/?/, "").split("/")
  return {
    route: ROUTES.find(route => HASHES[route] === `#/${page}`) ?? "game",
    params: rest.filter(Boolean).map(decodeURIComponent),
  }
}

export function useRoute() {
  const [{ route, params }, setCurrent] = useState(current)

  useEffect(() => {
    const handleChange = () => setCurrent(current())
    window.addEventListener("hashchange", handleChange)
    return () => window.removeEventListener("hashchange", handleChange)
  }, [])

  return { route, params, navigate }
}

// Goes to a page, and to something within it if more is given
export function navigate(to: Route, ...params: (string | number)[]) {
  window.location.hash = HASHES[to].replace(/\/$/, "") + (to === "game" && params.length === 0 ? "/" : "") + params.map(param => `/${encodeURIComponent(param)}`).join("")
}
