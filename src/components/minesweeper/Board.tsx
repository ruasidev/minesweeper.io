import { useSoloGameContext } from "../../context/SoloGameContext"
import BoardGrid from "./BoardGrid"

// The singleplayer board
export default function Board() {
  const { view, origin, chordHint, resetKey, click, flag } = useSoloGameContext()
  return <BoardGrid view={view} origin={origin} chordHint={chordHint} resetKey={resetKey} onCellClick={click} onCellRightClick={flag} />
}
