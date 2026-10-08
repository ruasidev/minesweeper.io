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
