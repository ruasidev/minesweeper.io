import { useTheme } from "../../context/ThemeContext"
import { plural } from "../../lib/text"
import type { Board } from "../../../shared/engine/board"
import { minesLeft } from "../../../shared/training/trial"
import MineIcon from "../minesweeper/MineIcon"

// How many mines are left on the board of a round, for the rounds that are about exactly that. It is the one
// thing on the screen such a round can't be done without, so it is made to look like it: no other round has one
export default function MinesLeft({ board }: { board: Board }) {
  const { theme } = useTheme()
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/70 bg-amber-400/15 text-sm font-bold whitespace-nowrap cursor-default ${theme.textHead}`}>
      <MineIcon className="w-4 h-4" />
      {plural(minesLeft(board), "mine")} left
    </span>
  )
}
