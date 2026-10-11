import { useEffect, useState } from "react"

// Whether something that has finished has had its moment on the screen and can be let go of: a board that was just
// cleared stays up for its win to play out before the result takes its place.
//
// It is true `afterMs` after `finished` becomes so. What had already finished when this was first asked has had its
// moment, and is let go of at once. It is put this way round, and not as "being held", on purpose: asked on the
// very render in which the thing finishes, the answer is already no, so whatever is showing it is never taken off
// the screen and put back. A board that was would miss playing its own win, and being heard doing it
export function useLetGo(finished: boolean, afterMs: number): boolean {
  const [letGo, setLetGo] = useState(finished)
  useEffect(() => {
    if (!finished) return setLetGo(false)
    const timer = setTimeout(() => setLetGo(true), afterMs)
    return () => clearTimeout(timer)
  }, [finished, afterMs])
  return finished && letGo
}
