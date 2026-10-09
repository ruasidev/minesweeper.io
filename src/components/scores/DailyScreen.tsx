import { useCallback, useEffect, useRef, useState } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useConnection } from "../../context/ConnectionContext"
import { Activity } from "lucide-react"
import type { AuthMode } from "../../game/types"
import { useLayout } from "../../hooks/useLayout"
import { getDaily, type DailyInfo } from "../../lib/api"
import { formatScore } from "../../lib/time"
import Page from "../app/Page"
import BoardStage from "../minesweeper/BoardStage"
import Dock, { FlagToggle } from "../minesweeper/Dock"
import GameBar, { BarField } from "../minesweeper/GameBar"
import { GameClock } from "../multiplayer/GameView"
import PlayableBoard from "../multiplayer/PlayableBoard"
import ScoreTable from "./ScoreTable"

const describe = ({ rows, cols, mines }: DailyInfo["settings"]) => `${rows} × ${cols}, ${mines} mines`

// On a small screen a board that has just been cleared stays up this long, for its win to play out, before the
// page with the day's times takes its place
const WIN_HOLD_MS = 2200

// Whether today's board is on screen to be played. On a phone or a tablet that decides how the whole page is laid
// out, since a board there takes the page over; and there a cleared board makes way for the day's times after a moment
function useDailyOnBoard(): boolean {
  const { compact } = useLayout()
  const { daily, board } = useConnection()
  const finished = daily ? daily.finishedMs !== null : false
  const [held, setHeld] = useState(false)
  // a board that was cleared before coming to this page has had its moment already
  const clearedBefore = useRef(finished)
  useEffect(() => {
    if (!finished || clearedBefore.current) {
      clearedBefore.current = finished
      return
    }
    setHeld(true)
    const timer = setTimeout(() => setHeld(false), WIN_HOLD_MS)
    return () => clearTimeout(timer)
  }, [finished])
  return Boolean(daily && board) && (!compact || !finished || held)
}

// A signed-in player's go at today's board
function DailyGame({ info, onChanged, onBoard }: { info: DailyInfo, onChanged: () => void, onBoard: boolean }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const multiplayer = useConnection()
  const { refreshProfile } = useAccount()
  const { compact, short, touch } = useLayout()
  const { daily, board } = multiplayer
  const finishedMs = daily?.finishedMs ?? null

  // once the board is cleared, the result and the leaderboard are fetched again (a moment later: the server is saving it)
  useEffect(() => {
    if (finishedMs === null) return
    const timer = setTimeout(() => {
      onChanged()
      // clearing it is worth a lot of experience
      refreshProfile()
    }, 600)
    return () => clearTimeout(timer)
  }, [finishedMs, onChanged, refreshProfile])

  // being played right now, or just cleared and still on screen
  if (daily && board && onBoard) {
    const playableBoard = (
      <PlayableBoard
        settings={daily.settings}
        ownBoard={board}
        startsAt={multiplayer.dailyStartedAt}
        start={daily.start}
        finished={finishedMs !== null}
        centered={compact}
        onReveal={multiplayer.reveal}
        onFlag={multiplayer.flag}
      />
    )
    if (compact) {
      const figure = `text-sm font-bold leading-5 tabular-nums ${theme.textHead}`
      return (
        <BoardStage
          status={
            <GameBar icon={<Activity className="w-4 h-4" />} label="Daily" vertical={short} columns={3}>
              <BarField label="Time" vertical={short}>
                <span className={figure}><GameClock startedAt={multiplayer.dailyStartedAt} finishedMs={finishedMs} /></span>
              </BarField>
              <BarField label="Uncovered" vertical={short}>
                <span className={`${figure} ${finishedMs !== null ? "text-green-500!" : ""}`}>{daily.percent}%</span>
              </BarField>
              <BarField label="Mines hit" vertical={short}>
                <span className={figure}>{daily.mineHits}</span>
              </BarField>
            </GameBar>
          }
          dock={touch ? <Dock><FlagToggle /></Dock> : undefined}
        >
          {playableBoard}
        </BoardStage>
      )
    }
    return (
      <>
        <section className={`${styles.card} flex flex-wrap items-center gap-x-6 gap-y-3 p-4 cursor-default ${theme.textBody}`}>
          <span className="font-semibold"><GameClock startedAt={multiplayer.dailyStartedAt} finishedMs={finishedMs} /></span>
          <span className="font-semibold">{daily.percent}% uncovered</span>
          {daily.mineHits > 0 && <span className="font-semibold">{daily.mineHits} {daily.mineHits === 1 ? "mine" : "mines"} hit</span>}
          {finishedMs !== null && <span className="font-semibold text-green-500">Cleared in {formatScore(finishedMs)}</span>}
        </section>
        {playableBoard}
      </>
    )
  }

  // cleared earlier today
  if (info.mine && info.mine.durationMs !== null) {
    return (
      <section className={`${styles.card} flex flex-col gap-2 p-4 w-full cursor-default ${theme.textBody}`}>
        <h2 className={`text-xl font-semibold ${theme.textHead}`}>Done for today</h2>
        <p>
          You cleared today's board in <span className="font-semibold">{formatScore(info.mine.durationMs)}</span>
          {info.mine.mineHits ? `, hitting ${info.mine.mineHits} ${info.mine.mineHits === 1 ? "mine" : "mines"}` : " without hitting a mine"}.
          A new board arrives at midnight UTC.
        </p>
      </section>
    )
  }

  const startError = multiplayer.error?.action === "startDaily" ? multiplayer.error.message : null
  return (
    <section className={`${styles.card} flex flex-col items-start gap-3 p-4 w-full ${theme.textBody}`}>
      <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Today's board: {describe(info.settings)}</h2>
      <p className="cursor-default">
        Everyone gets the same board today. Your clock starts when you press Start and doesn't stop until the board
        is cleared, even if you leave and come back. Hitting a mine covers back up what you had uncovered around it.
      </p>
      {info.mine && <p className="font-semibold cursor-default">Your clock is already running.</p>}
      <button className={`${styles.primary} px-6! max-sm:w-full`} disabled={multiplayer.status !== "connected"} onClick={multiplayer.startDaily}>
        {info.mine ? "Continue" : "Start"}
      </button>
      {startError && <p role="alert" className="text-sm text-red-500 font-semibold">{startError}</p>}
    </section>
  )
}

// The daily challenge. It takes the game's place beside the left pane
export default function DailyScreen({ onOpenAuth }: { onOpenAuth: (mode: AuthMode) => void }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session, isPending } = useAccount()
  const { compact } = useLayout()
  const onBoard = useDailyOnBoard()
  const [info, setInfo] = useState<DailyInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const userId = session?.user.id

  const load = useCallback(() => {
    getDaily().then(loaded => { setInfo(loaded); setError(null) }, (e: Error) => setError(e.message))
  }, [])
  // again when who is signed in changes: the answer includes their own go
  useEffect(load, [load, userId])

  // on a small screen a board being played has the page to itself: the day's times are there again once it is cleared
  const boardOnly = compact && onBoard && Boolean(session)
  return (
    <Page
      title="Daily challenge"
      aside={info && <span className={`text-sm opacity-70 ${theme.textBody}`}>{info.date}</span>}
      maxWidth={onBoard ? "max-w-none" : "max-w-2xl"}
      fill={boardOnly}
    >
        {error && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}

        {info && !isPending && (
          <>
            {session ? (
              // keyed by account, so signing in as someone else starts a fresh connection as them
              <DailyGame key={session.user.id} info={info} onChanged={load} onBoard={onBoard} />
            ) : (
              <section className={`${styles.card} flex flex-col items-start gap-3 p-4 w-full ${theme.textBody}`}>
                <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Today's board: {describe(info.settings)}</h2>
                <p className="cursor-default">One board a day, the same for everyone, against the clock. You need an account to play it.</p>
                <div className="flex gap-2">
                  <button className={styles.ghost} onClick={() => onOpenAuth("signIn")}>Log in</button>
                  <button className={styles.primary} onClick={() => onOpenAuth("signUp")}>Sign up</button>
                </div>
              </section>
            )}

            {!boardOnly && (
              <section className={`${styles.card} overflow-hidden w-full`}>
                <h2 className={`p-4 text-xl font-semibold cursor-default ${theme.textHead}`}>Today's times</h2>
                <ScoreTable entries={info.entries} emptyText="Nobody has cleared today's board yet." highlightUserId={userId} />
              </section>
            )}
          </>
        )}
    </Page>
  )
}
