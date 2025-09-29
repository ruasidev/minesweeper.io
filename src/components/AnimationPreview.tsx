import { useState, useEffect } from "react"
import type { AnimationPreviewProps } from "../game/animations"
import { lossAnimations } from "../game/animations"
import { computePreview } from "../game/animationPreview"

export function AnimationPreview({ animation, theme }: AnimationPreviewProps) {
  const [hovered, setHovered] = useState(false)
  const [cycleKey, setCycleKey] = useState(0)

  const { chosenCells, originCell, delays, cycleTime } = computePreview(animation, 16)

  const lossConfig = lossAnimations.find(a => a.id === animation)

  useEffect(() => {
    if (!hovered) return
    const timer = setInterval(() => setCycleKey(k => k + 1), cycleTime)
    return () => clearInterval(timer)
  }, [hovered, cycleTime])

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="grid grid-cols-4 w-20 h-20"
      key={cycleKey}
    >
      {Array.from({ length: 16 }).map((_, i) => {
        let animationClass = ""
        if (hovered && chosenCells.has(i)) {
          if (lossConfig && i === originCell) {
            // use originAnim if available
            animationClass = `animate-${lossConfig.originAnim}`
          } else {
            // otherwise just use the regular animation
            animationClass = `animate-${animation}`
          }
        }

        return (
          <span
            key={i}
            className={`w-4.75 h-4.75 border rounded-xs flex items-center justify-center 
              ${animationClass}
              ${theme.cellBorder}
              ${theme.cellHidden}
            `}
            style={{
              animationIterationCount: 1,
              animationFillMode: "forwards",
              animationDelay: `${delays[i]}ms`,
            }}
          />
        )
      })}
    </div>
  )
}
