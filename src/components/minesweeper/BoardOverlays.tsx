import { useEffect, useRef, useState } from "react"
import type { Blast } from "../../lib/blast"
import { boxAround, cellBox } from "../../lib/boardMetrics"
import { playSound } from "../../lib/sounds"
import type { CellPosition } from "../../../shared/protocol"

// What lies over a board while a game is being played on it. Each goes inside a BoardViewport, beside the grid

// Lies over the board for the moment a player sits out after a mine goes off: a faint red, and nothing can be clicked
export function MineCooldown({ until }: { until: number }) {
  const [left, setLeft] = useState(() => until - Date.now())
  useEffect(() => {
    const tick = () => setLeft(until - Date.now())
    tick()
    const timer = setInterval(tick, 100)
    return () => clearInterval(timer)
  }, [until])

  if (left <= 0) return null
  return <div className="absolute inset-0 z-10 rounded bg-red-500/10 cursor-not-allowed" />
}

// The ring that spreads out from a mine as it goes off, as far as its blast reaches
export function BlastRing({ blast, radius }: { blast: Blast, radius: number }) {
  return (
    <div
      className="absolute z-10 rounded-full pointer-events-none game-motion animate-blastRing"
      style={boxAround(blast.row, blast.col, 2 * radius + 1)}
    />
  )
}

// "Go!" stays up this long after play has begun
const GO_SHOWN_MS = 700
// a sound or a number due this long ago or less is still worth giving
const LATE_MS = 150

// What the countdown is showing at a moment: the seconds left (3, 2, 1), 0 for "Go!", or null once it has gone
function countAt(startsAt: number, now: number): number | null {
  const left = startsAt - now
  return left > 0 ? Math.ceil(left / 1000) : left > -GO_SHOWN_MS ? 0 : null
}

// The countdown before play begins on a board that was dealt. The board stays in view but dimmed, with the cell it
// was opened on ringed, and the dim lifts on the instant play begins: when a game is a race, that instant has to be
// unmistakable. Everything is timed to the moment itself, the sounds by the sound hardware's own clock
export function StartCountdown({ startsAt, opening }: { startsAt: number, opening: CellPosition }) {
  const [count, setCount] = useState(() => countAt(startsAt, Date.now()))
  const markerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const left = startsAt - Date.now()
    setCount(countAt(startsAt, Date.now()))
    const timers: ReturnType<typeof setTimeout>[] = []
    const cancelSounds: (() => void)[] = []

    // not when coming back to a game that is already under way
    if (left > -LATE_MS) {
      // a beep and a new number on each second still to come, and the last of them is the start itself
      for (let seconds = Math.max(0, Math.ceil(left / 1000)); seconds >= 0; seconds--) {
        const wait = left - seconds * 1000
        if (wait < -LATE_MS) continue
        cancelSounds.push(playSound(seconds > 0 ? "countdown" : "go", wait))
        timers.push(setTimeout(() => setCount(seconds), Math.max(0, wait)))
      }
    }
    timers.push(setTimeout(() => setCount(null), Math.max(0, left + GO_SHOWN_MS)))

    return () => {
      timers.forEach(clearTimeout)
      cancelSounds.forEach(cancel => cancel())
    }
  }, [startsAt])

  // on a board bigger than the screen, bring where it starts into view
  useEffect(() => {
    markerRef.current?.scrollIntoView({ block: "center", inline: "center" })
  }, [])

  if (count === null) return null
  return (
    <div className={`absolute inset-0 z-10 pointer-events-none rounded ${count > 0 ? "bg-black/45" : ""}`}>
      <div
        ref={markerRef}
        className="absolute rounded ring-4 ring-white shadow-[0_0_12px_4px_rgba(0,0,0,0.6)]"
        style={cellBox(opening.row, opening.col)}
      />
      {/* In the middle of what can be seen of the board, wherever that is on a board too big for its space:
          it is as wide as that space (100cqw, see .board-viewport) and stays put while the board is panned */}
      <div className="sticky top-1/3 left-0 w-[min(100%,100cqw)] flex justify-center">
        <span className={`text-7xl font-extrabold [text-shadow:0_2px_12px_rgba(0,0,0,0.9)] ${count > 0 ? "text-white" : "text-green-400"}`}>
          {count > 0 ? count : "Go!"}
        </span>
      </div>
    </div>
  )
}
