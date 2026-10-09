import { useEffect, useState } from "react"

// How many milliseconds are left until a moment (by this browser's clock), kept up to date. Never below zero
export function useTimeLeft(until: number): number {
  const [left, setLeft] = useState(() => Math.max(0, until - Date.now()))
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, until - Date.now()))
    tick()
    const timer = setInterval(tick, 200)
    return () => clearInterval(timer)
  }, [until])
  return left
}
