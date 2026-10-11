import type { ReactNode } from "react"
import { useLayout } from "../../hooks/useLayout"

type BoardStageProps = {
  // what is read while playing: figures, who else is in the game
  status?: ReactNode
  // what is pressed while playing
  dock?: ReactNode
  // the board, in its BoardViewport
  children: ReactNode
}

// How a board being played is laid out on a phone or a tablet. Nothing here scrolls but the board itself: what is
// read stays along the top, what is pressed stays along the bottom within reach of a thumb, and the board has all
// the room between them to be panned about in. On a phone held sideways there is no height to spare for bars
// above and below, so both go in a column down the right-hand side instead
export default function BoardStage({ status, dock, children }: BoardStageProps) {
  const { short } = useLayout()
  // all the height there is, whether what it is put in is a column that shares its height out or a plain box
  const frame = "h-full flex-1 min-h-0"

  if (short) {
    return (
      <div className={`${frame} flex`}>
        <div className="flex-1 min-w-0 flex flex-col">
          {children}
        </div>
        {(status || dock) && (
          <div className="shrink-0 w-44 flex flex-col gap-2 p-2 pl-0 overflow-y-auto hide-scrollbar">
            {status && <div className="shrink-0">{status}</div>}
            {dock && <div className="shrink-0 mt-auto">{dock}</div>}
          </div>
        )}
      </div>
    )
  }

  // the bars are no wider than is comfortable to read across, however wide the tablet
  const bar = "shrink-0 w-full max-w-2xl mx-auto px-2"
  return (
    <div className={`${frame} flex flex-col`}>
      {status && <div className={`${bar} pt-2`}>{status}</div>}
      {children}
      {dock && <div className={`${bar} pb-2`}>{dock}</div>}
    </div>
  )
}
