import { useEffect, useState } from "react"
import { Activity, Ellipsis } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useSettings } from "../../context/SettingsContext"
import { useTheme } from "../../context/ThemeContext"
import { useElementWidth } from "../../hooks/useElementWidth"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useLayout } from "../../hooks/useLayout"
import type { Multiplayer } from "../../hooks/useMultiplayer"
import { useTimeLeft } from "../../hooks/useTimeLeft"
import { playSound } from "../../lib/sounds"
import { formatDuration, formatTimeLeft } from "../../lib/time"
import type { GameSummary, RoomDetail } from "../../../shared/protocol"
import FloatingWindow from "../app/FloatingWindow"
import BoardStage from "../minesweeper/BoardStage"
import Dock, { FlagToggle } from "../minesweeper/Dock"
import GameBar, { BarField } from "../minesweeper/GameBar"
import OpponentBox from "./OpponentBox"
import PlayableBoard from "./PlayableBoard"

// How long a game has been going, or how long this player took once they've finished
export function GameClock({ startedAt, finishedMs }: { startedAt: number | null, finishedMs: number | null }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (finishedMs !== null) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [finishedMs])
  return <span className="tabular-nums">{formatDuration(finishedMs ?? (startedAt === null ? 0 : now - startedAt))}</span>
}

// The clock on the players still going, which starts once enough of the others have finished.
// It stays in view however far down the board they have scrolled, and beeps when it starts and through its last seconds
function TimeLimit({ deadlineAt }: { deadlineAt: number }) {
  const { compact } = useLayout()
  const left = useTimeLeft(deadlineAt)
  const lastSeconds = left <= 10_000

  useEffect(() => {
    const untilEnd = deadlineAt - Date.now()
    const beeps = [playSound("countdown")]
    for (const seconds of [3, 2, 1]) {
      if (untilEnd > seconds * 1000) beeps.push(playSound("countdown", untilEnd - seconds * 1000))
    }
    return () => beeps.forEach(cancel => cancel())
  }, [deadlineAt])

  return (
    <div
      role="timer"
      className={`flex items-center gap-3 rounded-xl shadow-lg shadow-black/40 font-semibold cursor-default text-white
        ${compact ? "px-3 py-1.5 text-sm" : "sticky top-2 z-20 self-start px-4 py-2"}
        ${lastSeconds ? "bg-red-600 animate-pulse" : "bg-amber-600"}`}
    >
      <span className={`font-extrabold tabular-nums ${compact ? "text-xl" : "text-2xl"}`}>{formatTimeLeft(left)}</span>
      <span>{compact ? "left: enough of the others have finished" : "left to clear the board: enough of the others have finished"}</span>
    </div>
  )
}

// How much room a column of the other players' boards needs beside this player's own, with the gap between them
const SIDE_COLUMN = 150
const SIDE_GAP = 24

// A multiplayer game while this player is still in it: their own board in the middle, as in singleplayer, with the
// other players' progress down either side of it. Where the window is too narrow for that (or the board too wide),
// the others go in a row above the board instead.
// On a phone or a tablet the board has the screen: the figures and the other players are a strip along the top,
// the switch between digging and flagging is under a thumb, and leaving or giving up is behind a button
export default function GameView({ room, game, multiplayer }: { room: RoomDetail, game: GameSummary, multiplayer: Multiplayer }) {
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
  const isHost = room.hostId === myId
  // everyone else who started, including anyone who has left the room since
  const opponents = game.players.filter(player => player.id !== myId && game.progress[player.id])
  const boardWidth = game.settings.cols * display.cellSize + (game.settings.cols - 1) * display.cellGap
  const beside = opponents.length > 0 && areaWidth >= boardWidth + 2 * (SIDE_COLUMN + SIDE_GAP)
  const boxFor = (player: typeof opponents[number]) => (
    <OpponentBox key={player.id} player={player} progress={game.progress[player.id]} game={game} />
  )

  const board = multiplayer.board && (
    <PlayableBoard
      settings={game.settings}
      ownBoard={multiplayer.board}
      startsAt={multiplayer.gameStartedAt}
      start={game.start}
      finished={mine?.outcome === "cleared"}
      centered
      onReveal={multiplayer.reveal}
      onFlag={multiplayer.flag}
    />
  )

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
                <BarField label="Time" vertical={short}>
                  <span className={figure}><GameClock startedAt={multiplayer.gameStartedAt} finishedMs={finishedMs} /></span>
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
                  {opponents.map(player => <OpponentBox key={player.id} chip player={player} progress={game.progress[player.id]} game={game} />)}
                </div>
              )}
            </div>
          }
          banner={playing && multiplayer.gameDeadlineAt !== null && <TimeLimit deadlineAt={multiplayer.gameDeadlineAt} />}
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
                  <button className={`${menuButton} text-red-500`} onClick={() => { multiplayer.giveUp(); setMenuOpen(false) }}>Yes, give up</button>
                  <button className={menuButton} onClick={() => setConfirmingGiveUp(false)}>Keep playing</button>
                </>
              ) : (
                <>
                  {playing && <button className={menuButton} onClick={() => setConfirmingGiveUp(true)}>Give up</button>}
                  {isHost && <button className={menuButton} onClick={() => { multiplayer.endGame(); setMenuOpen(false) }}>End the game for everyone</button>}
                  <button className={menuButton} onClick={multiplayer.leaveRoom}>Leave room</button>
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
      <section className={`${styles.card} flex flex-wrap items-center gap-x-6 gap-y-3 p-4 cursor-default ${theme.textBody}`}>
        <h2 className={`text-xl font-semibold truncate ${theme.textHead}`}>{room.name}</h2>
        <span className="font-semibold"><GameClock startedAt={multiplayer.gameStartedAt} finishedMs={finishedMs} /></span>
        {mine && <span className="font-semibold">{mine.percent}% uncovered</span>}
        {mine && mine.mineHits > 0 && <span className="font-semibold">{mine.mineHits} {mine.mineHits === 1 ? "mine" : "mines"} hit</span>}
        {mine?.outcome === "cleared" && <span className="font-semibold text-green-500">Board cleared!</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {playing && (confirmingGiveUp ? (
            <>
              <span className="font-semibold">Give up?</span>
              <button className={`${styles.button} text-red-500`} onClick={multiplayer.giveUp}>Yes, give up</button>
              <button className={styles.ghost} onClick={() => setConfirmingGiveUp(false)}>Keep playing</button>
            </>
          ) : (
            <button className={styles.ghost} onClick={() => setConfirmingGiveUp(true)}>Give up</button>
          ))}
          {isHost && !confirmingGiveUp && (
            <button className={styles.ghost} title="Stop the game for everyone" onClick={multiplayer.endGame}>End game</button>
          )}
          {!confirmingGiveUp && <button className={styles.ghost} onClick={multiplayer.leaveRoom}>Leave room</button>}
        </div>
      </section>

      {playing && multiplayer.gameDeadlineAt !== null && <TimeLimit deadlineAt={multiplayer.gameDeadlineAt} />}

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
