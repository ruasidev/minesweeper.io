import { useTheme } from "../../../context/ThemeContext"
import type { Board } from "../../../game/types"

// the map is about this wide, however many columns the board has
const MAP_WIDTH = 380

// What each cell of a lost board is on the map, and the colour it is drawn in. Covered and uncovered cells take the
// theme's own colours, so the map looks like the board; the rest are the same in every theme
const KINDS = {
  hit: { label: "The mine you hit", color: "bg-white ring-2 ring-red-500 z-10" },
  mine: { label: "Mines you hadn't found", color: "bg-red-500" },
  rightFlag: { label: "Flags on mines", color: "bg-green-500" },
  wrongFlag: { label: "Flags that were wrong", color: "bg-amber-400" },
} as const

type Kind = keyof typeof KINDS

function kindOf(cell: Board["grid"][number][number]): Kind | null {
  if (cell.hasMine) return cell.revealed ? "hit" : cell.flagged ? "rightFlag" : "mine"
  return cell.flagged ? "wrongFlag" : null
}

// A lost board in miniature, with everything the player couldn't see: where the mines were, the one that ended the
// game, and which of their flags were right. Under it, what each colour on it means
export default function BoardMap({ board }: { board: Board }) {
  const { theme } = useTheme()
  const size = Math.max(3, Math.min(16, Math.floor(MAP_WIDTH / board.cols)))
  const gap = size > 5 ? 1 : 0
  const cells = board.grid.flat()
  const counts = new Map<Kind, number>()
  for (const cell of cells) {
    const kind = kindOf(cell)
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`grid p-1.5 rounded-lg border ${theme.background} ${theme.itemBorder}`}
        style={{ gridTemplateColumns: `repeat(${board.cols}, ${size}px)`, gridAutoRows: `${size}px`, gap }}
      >
        {cells.map((cell) => {
          const kind = kindOf(cell)
          return (
            <div
              key={`${cell.row}-${cell.col}`}
              className={`relative ${size > 5 ? "rounded-[2px]" : ""} ${kind ? KINDS[kind].color : cell.revealed ? theme.cellVisible : theme.cellHidden}`}
            />
          )
        })}
      </div>
      <ul className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs ${theme.textBody}`}>
        {(Object.keys(KINDS) as Kind[]).filter(kind => counts.has(kind)).map(kind => (
          <li key={kind} className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-[2px] ${KINDS[kind].color.replace("z-10", "").replace("ring-2", "ring-1")}`} />
            {KINDS[kind].label}
            {kind !== "hit" && <span className="opacity-60 tabular-nums">{counts.get(kind)}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
