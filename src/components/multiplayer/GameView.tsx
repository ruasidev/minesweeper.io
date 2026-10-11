import { useEffect, useState } from "react"
import { Activity, Ellipsis } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useSettings } from "../../context/SettingsContext"
import { useTheme } from "../../context/ThemeContext"
import { useElementWidth } from "../../hooks/useElementWidth"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useLayout } from "../../hooks/useLayout"
import type { ServerConnection } from "../../hooks/useServerConnection"
import { useTimeLeft } from "../../hooks/useTimeLeft"
import { playSound } from "../../lib/sounds"
import { boardSpan } from "../../lib/boardFit"
import { ownGameIn } from "../../lib/connection"
import { formatTimeLeft } from "../../lib/time"
import { rulesOf } from "../../../shared/game/modes"
import type { GameSummary, RoomDetail } from "../../../shared/protocol"
import FloatingWindow from "../app/FloatingWindow"
import BoardStage from "../minesweeper/BoardStage"
import Dock, { FlagToggle } from "../minesweeper/Dock"
import GameBar, { BarField } from "../minesweeper/GameBar"
import GameClock from "../minesweeper/GameClock"
import LiveBoard from "../minesweeper/LiveBoard"
import OpponentBox from "./OpponentBox"
import { plural } from "../../lib/text"

// The clock on the players still going, which starts once enough of the others have finished.
//
// Wherever it is shown, it takes up no room that wasn't already set aside for it: it starts in the middle of a
// game, and a board that moved under the pointer just then would be a click on the wrong cell.

// It beeps when it starts and through its last seconds
function useTimeLimitBeeps(deadlineAt: number | null) {
  useEffect(() => {
    if (deadlineAt === null) return
    const untilEnd = deadlineAt - Date.now()
    const beeps = [playSound("countdown")]
    for (const seconds of [3, 2, 1]) {
      if (untilEnd > seconds * 1000) beeps.push(playSound("countdown", untilEnd - seconds * 1000))
    }
    return () => beeps.forEach(cancel => cancel())
  }, [deadlineAt])
}

// On a big screen: a pill that floats over the head of the game, and stays in view however far down the board
// the player has scrolled. `spare` is the same pill with nothing in it to see: what keeps its room for it
function TimeLimitPill({ deadlineAt, spare }: { deadlineAt: number, spare?: boolean }) {
  const left = useTimeLeft(deadlineAt)
  const lastSeconds = left <= 10_000
  return (
    <div
      role={spare ? undefined : "timer"}
      aria-hidden={spare}
      className={`flex items-center gap-3 px-4 py-1.5 rounded-xl font-semibold whitespace-nowrap cursor-default text-white
        ${spare ? "invisible" : `shadow-lg shadow-black/40 ${lastSeconds ? "bg-red-600 animate-pulse" : "bg-amber-600"}`}`}
    >
      <span className="text-2xl font-extrabold tabular-nums">{spare ? "00:00" : formatTimeLeft(left)}</span>
      <span>left to finish</span>
    </div>
  )
}

// On a small one: the figure the game's own clock has on the bar, counting down in its place
function TimeLeftFigure({ deadlineAt, className }: { deadlineAt: number, className: string }) {
  const left = useTimeLeft(deadlineAt)
  return <span role="timer" className={`${className} ${left <= 10_000 ? "text-red-500! animate-pulse" : "text-amber-500!"}`}>{formatTimeLeft(left)}</span>
}

// How much room a column of the other players' boards needs beside this player's own, with the gap between them
const SIDE_COLUMN = 150
const SIDE_GAP = 24

// A multiplayer game while this player is still in it: their own board in the middle, as in singleplayer, with the
// other players' progress down either side of it. Where the window is too narrow for that (or the board too wide),
// the others go in a row above the board instead.
// On a phone or a tablet the board has the screen: the figures and the other players are a strip along the top,
// the switch between digging and flagging is under a thumb, and leaving or giving up is behind a button
export default function GameView({ room, game, connection }: { room: RoomDetail, game: GameSummary, connection: ServerConnection }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session } = useAccount()
  const { settings: display } = useSettings()
  const { compact, short, touch } = useLayout()
  const [areaRef, areaWidth] = useElementWidth<HTMLDivElement>()
  // giving up takes a second press, so it can't happen by a slip of the mouse
  const [confirmingGiveUp, setConfirmingGiveUp] = useState(false)
  // On a small screen: the window with the ways out of the game
  const [menuOpen, setMenuOpen] = useState(false)

  const myId = session?.user.id
  const mine = myId ? game.progress[myId] : undefined
  const playing = mine?.outcome === "playing"
  const finishedMs = mine?.finishedMs ?? null
  // when this player's time is up, once that clock is running: only those still playing are on it
  const deadlineAt = playing ? connection.gameDeadlineAt : null
  useTimeLimitBeeps(deadlineAt)
  const isHost = room.hostId === myId
  // everyone else who started, including anyone who has left the room since
  const opponents = game.players.filter(player => player.id !== myId && game.progress[player.id])
  const boardWidth = boardSpan(game.settings.cols, display.cellSize, display.cellGap)
  const beside = opponents.length > 0 && areaWidth >= boardWidth + 2 * (SIDE_COLUMN + SIDE_GAP)
  const boxFor = (player: typeof opponents[number]) => (
    <OpponentBox key={player.id} player={player} progress={game.progress[player.id]} sectionCols={game.sectionCols} />
  )

  // this player's own board in the game, once it has arrived
  const own = ownGameIn(connection, "multiplayer")
  const board = own?.id === game.id && <LiveBoard game={own} centered onReveal={connection.reveal} onFlag={connection.flag} />

  if (compact) {
    const figure = `text-sm font-bold leading-5 tabular-nums ${theme.textHead}`
    const menuButton = `${styles.button} w-full py-3 text-left`
    return (
      <>
        <BoardStage
          status={
            <div className="flex flex-col gap-2">
              <GameBar
                icon={<Activity className="w-4 h-4" />}
                label="Game"
                vertical={short}
                columns={3}
                action={
                  <button
                    className={`shrink-0 inline-flex items-center justify-center gap-2 border rounded-md text-sm font-semibold pressable
                      ${short ? "px-3 py-2" : "w-10 h-10"}
                      ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}`}
                    title="Give up or leave"
                    aria-label="Give up or leave"
                    onClick={() => setMenuOpen(true)}
                  >
                    <Ellipsis className="w-4 h-4" />
                    {short && "Game"}
                  </button>
                }
              >
                {/* the clock on the players still going counts down where the game's own clock was: nothing new
                    comes onto the screen, so nothing on it moves */}
                <BarField label={deadlineAt !== null ? "Time left" : "Time"} vertical={short}>
                  {deadlineAt !== null
                    ? <TimeLeftFigure deadlineAt={deadlineAt} className={figure} />
                    : <span className={figure}><GameClock startedAt={connection.gameStartedAt} durationMs={finishedMs} /></span>}
                </BarField>
                <BarField label="Uncovered" vertical={short}>
                  <span className={`${figure} ${mine?.outcome === "cleared" ? "text-green-500!" : ""}`}>{mine?.percent ?? 0}%</span>
                </BarField>
                <BarField label="Mines hit" vertical={short}>
                  <span className={figure}>{mine?.mineHits ?? 0}</span>
                </BarField>
              </GameBar>
              {/* everyone else, a thumbnail each: a strip that scrolls sideways, or a list down the side of a phone held sideways */}
              {opponents.length > 0 && (
                <div className={`flex gap-2 ${short ? "flex-col" : "overflow-x-auto hide-scrollbar"}`}>
                  {opponents.map(player => <OpponentBox key={player.id} chip player={player} progress={game.progress[player.id]} sectionCols={game.sectionCols} />)}
                </div>
              )}
            </div>
          }
          // it stays while a cleared board plays out its win, so the board doesn't jump as it does
          dock={touch ? <Dock><FlagToggle /></Dock> : undefined}
        >
          {board}
        </BoardStage>

        {menuOpen && (
          <FloatingWindow title={room.name} sheet className="w-[min(24rem,94vw)]" onClose={() => { setMenuOpen(false); setConfirmingGiveUp(false) }}>
            <div className={`flex flex-col gap-2 ${theme.textBody}`}>
              {confirmingGiveUp ? (
                <>
                  <p className="pb-1 cursor-default">Give up this game? Your board stops where it is, and you can watch the others.</p>
                  <button className={`${menuButton} text-red-500`} onClick={() => { connection.giveUp(); setMenuOpen(false) }}>Yes, give up</button>
                  <button className={menuButton} onClick={() => setConfirmingGiveUp(false)}>Keep playing</button>
                </>
              ) : (
                <>
                  {playing && <button className={menuButton} onClick={() => setConfirmingGiveUp(true)}>Give up</button>}
                  {isHost && <button className={menuButton} onClick={() => { connection.endGame(); setMenuOpen(false) }}>End the game for everyone</button>}
                  <button className={menuButton} onClick={connection.leaveRoom}>Leave room</button>
                </>
              )}
            </div>
          </FloatingWindow>
        )}
      </>
    )
  }

  return (
    <>
      {/* The clock on the players still going. It floats: it has no height of its own, so its coming and going
          moves nothing, and it sits over the place the head of the game keeps for it (below) until the page is
          scrolled, when it stays at the top of what can be seen. (The margin takes back the gap this would
          otherwise add between itself and the head of the game) */}
      <div className="sticky top-2 z-20 h-0 -mb-4 flex justify-center pointer-events-none">
        {deadlineAt !== null && <div className="mt-4"><TimeLimitPill deadlineAt={deadlineAt} /></div>}
      </div>

      {/* What is in the middle is that place. It is kept from the start in a game that can have such a clock,
          whether or not one is running, so that what is either side of it never has to make room */}
      <section className={`${styles.card} grid grid-cols-[1fr_auto_1fr] items-center gap-x-6 p-4 cursor-default ${theme.textBody}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
          <h2 className={`text-xl font-semibold truncate ${theme.textHead}`}>{room.name}</h2>
          <span className="font-semibold"><GameClock startedAt={connection.gameStartedAt} durationMs={finishedMs} /></span>
          {mine && <span className="font-semibold whitespace-nowrap tabular-nums">{mine.percent}% uncovered</span>}
          {/* there from the start, at nought: a figure that turned up with the first mine would push the rest along */}
          {mine && <span className="font-semibold whitespace-nowrap tabular-nums">{plural(mine.mineHits, "mine")} hit</span>}
          {mine?.outcome === "cleared" && <span className="font-semibold text-green-500">Board cleared!</span>}
        </div>
        {/* at the top of the row, which is where the pill floats, however many lines the rest takes */}
        <div className="self-start">{rulesOf(game.mode).finishLimit && <TimeLimitPill deadlineAt={0} spare />}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {playing && (confirmingGiveUp ? (
            <>
              <span className="font-semibold">Give up?</span>
              <button className={`${styles.button} text-red-500`} onClick={connection.giveUp}>Yes, give up</button>
              <button className={styles.ghost} onClick={() => setConfirmingGiveUp(false)}>Keep playing</button>
            </>
          ) : (
            <button className={styles.ghost} onClick={() => setConfirmingGiveUp(true)}>Give up</button>
          ))}
          {isHost && !confirmingGiveUp && (
            <button className={styles.ghost} title="Stop the game for everyone" onClick={connection.endGame}>End game</button>
          )}
          {!confirmingGiveUp && <button className={styles.ghost} onClick={connection.leaveRoom}>Leave room</button>}
        </div>
      </section>

      <div ref={areaRef} className="flex flex-col gap-4">
        {!beside && opponents.length > 0 && <div className="flex flex-wrap justify-center gap-6">{opponents.map(boxFor)}</div>}

        {/* The board keeps its place among these whichever way the others are laid out, so it carries on undisturbed
            when the window is resized. The columns either side are equally wide, which is what keeps it in the middle */}
        <div className={beside ? "grid grid-cols-[1fr_auto_1fr] items-start" : ""} style={beside ? { columnGap: SIDE_GAP } : undefined}>
          {beside && <div className="flex flex-col items-end gap-5">{opponents.filter((_, at) => at % 2 === 0).map(boxFor)}</div>}
          {board}
          {beside && <div className="flex flex-col items-start gap-5">{opponents.filter((_, at) => at % 2 === 1).map(boxFor)}</div>}
        </div>
      </div>
    </>
  )
}
