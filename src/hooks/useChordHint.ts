import { useCallback, useEffect, useState } from "react"

// The cell of a chord that opened nothing; id changes on every attempt so the flash can replay
export type ChordHint = { row: number, col: number, id: number }

// How long a chord hint stays set: a little longer than the chordHint animation in appAnimations.css
const CHORD_HINT_MS = 500

// The brief flash over the cells a chord was checking, when the flags around it don't match its number yet
export function useChordHint() {
  const [chordHint, setChordHint] = useState<ChordHint | null>(null)

  useEffect(() => {
    if (!chordHint) return
    const t = setTimeout(() => setChordHint(null), CHORD_HINT_MS)
    return () => clearTimeout(t)
  }, [chordHint])

  const flashChordHint = useCallback((row: number, col: number) => {
    setChordHint(prev => ({ row, col, id: (prev?.id ?? 0) + 1 }))
  }, [])

  return [chordHint, flashChordHint] as const
}
