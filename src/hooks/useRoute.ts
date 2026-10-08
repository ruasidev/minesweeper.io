import { useEffect, useState } from "react"
import type { Route } from "../game/types"

// The site is served as plain files with no server to map addresses to pages,
// so which page is showing lives in the part of the address after the #
const ADMIN_HASH = "#/admin"
const currentRoute = (): Route => window.location.hash === ADMIN_HASH ? "admin" : "game"

export function useRoute() {
  const [route, setRoute] = useState<Route>(currentRoute)

  useEffect(() => {
    const handleChange = () => setRoute(currentRoute())
    window.addEventListener("hashchange", handleChange)
    return () => window.removeEventListener("hashchange", handleChange)
  }, [])

  const navigate = (to: Route) => {
    window.location.hash = to === "admin" ? ADMIN_HASH : "#/"
  }

  return { route, navigate }
}
