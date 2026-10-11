// 83000 → "01:23"
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
}

// 83450 → "1:23.4", for times that are compared with each other
export function formatScore(ms: number): string {
  const tenths = Math.floor(ms / 100)
  return `${Math.floor(tenths / 600)}:${(Math.floor(tenths / 10) % 60).toString().padStart(2, "0")}.${tenths % 10}`
}

// How long is left on a clock that is counting down: 400 → "00:01", so the last second reads as one second, not none
export const formatTimeLeft = (ms: number): string => formatDuration(Math.ceil(ms / 1000) * 1000)

const DAY_MS = 24 * 60 * 60 * 1000

// How long until the next day begins by the server's clock (UTC): when the next daily board arrives
export const msUntilNextUtcDay = (now: number): number => DAY_MS - now % DAY_MS

// How long is left until something a good way off, to the minute: 82_740_000 → "22h 59m", 2_400_000 → "40m"
export function formatCountdown(ms: number): string {
  const minutes = Math.ceil(Math.max(0, ms) / 60_000)
  if (minutes <= 1) return "under a minute"
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
