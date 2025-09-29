import { lossAnimations, winAnimations } from "../game/animations"

export type PreviewResult = {
  chosenCells: Set<number>
  originCell: number | null
  delays: number[]
  cycleTime: number
}

export function computePreview(animation: string, cellCount: number): PreviewResult {
  const lossConfig = lossAnimations.find(a => a.id === animation)
  const winConfig = winAnimations.find(a => a.id === animation)

  const cells = Array.from({ length: cellCount })
  let chosenCells = new Set<number>()
  let originCell: number | null = null

  const stepDelay = 80
  const baseDelay = lossConfig ? 200 : 0
  const animDuration = (lossConfig?.animDuration ?? winConfig?.animDuration ?? 40) * 10
  const pause = 500

  if (lossConfig) {
    const count = Math.floor(Math.random() * 2) + 5
    while (chosenCells.size < count) {
      chosenCells.add(Math.floor(Math.random() * cellCount))
    }
    if (lossConfig.originAnim !== "none") {
      const arr = Array.from(chosenCells)
      originCell = arr[Math.floor(Math.random() * arr.length)]
    }
  } else if (winConfig) {
    chosenCells = new Set(cells.map((_, i) => i))
    originCell = Math.floor(Math.random() * cellCount)
  }

  // compute per-cell delays
  const delays = cells.map((_, i) => {
    if (originCell === null) return 0
    if (i === originCell) return 0

    const row = Math.floor(i / 4)
    const col = i % 4
    const or = Math.floor(originCell / 4)
    const oc = originCell % 4
    const dist = Math.abs(row - or) + Math.abs(col - oc)
    return baseDelay + dist * stepDelay
  })

  // cycle time = ripple + animation + pause
  const maxDelay = Math.max(...delays)
  const cycleTime = maxDelay + animDuration + pause

  return { chosenCells, originCell, delays, cycleTime }
}
