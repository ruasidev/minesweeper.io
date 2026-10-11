import { useCallback, useEffect, useRef, useState } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useConnection } from "../../context/ConnectionContext"
import { Activity, Eye, Trophy } from "lucide-react"
import type { AuthMode } from "../../game/types"
import { useLayout } from "../../hooks/useLayout"
import { navigate } from "../../hooks/useRoute"
import { getDaily, type DailyInfo } from "../../lib/api"
import { ownGameIn } from "../../lib/connection"
import { dailyStanding, type DailyStanding } from "../../lib/daily"
import { ordinal } from "../../lib/gameResults"
import { formatCountdown, formatScore, msUntilNextUtcDay } from "../../lib/time"
import Page from "../app/Page"
import BoardStage from "../minesweeper/BoardStage"
import Dock, { FlagToggle } from "../minesweeper/Dock"
import GameBar, { BarField } from "../minesweeper/GameBar"
import GameClock from "../minesweeper/GameClock"
import GameResultItem from "../minesweeper/infoDisplay/GameResultItem"
import LiveBoard from "../minesweeper/LiveBoard"
import ScoreTable from "./ScoreTable"
import { boardSize } from "../../../shared/game/boards"
import { plural } from "../../lib/text"

// A board that has just been cleared stays up this long, for its win to play out, before the player's result and
// the day's times take its place
const WIN_HOLD_MS = 2200

// Whether today's board is on screen to be played. That decides how the whole page is laid out: a board being
// played has the page to itself, and a cleared one makes way for the result after a moment
function useDailyOnBoard(): boolean {
  const daily = ownGameIn(useConnection(), "daily")
  const finished = daily?.outcome === "cleared"
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
  return daily !== null && (!finished || held)
}

// the time now, looked at again every half minute: enough for something that counts down in minutes
function useNow(): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

// What a player who has cleared today's board is shown in its place: how they did, where that puts them among
// everyone who has cleared it, and when there is another to play. `fresh` is for a board cleared just now.
// `onViewBoard` is the way back to the board itself, as they played it: their own game, which shows them nothing
// they haven't already uncovered (and which nobody else is shown until the day is out)
function DailyResult({ standing, fresh, onViewBoard }: { standing: DailyStanding, fresh: boolean, onViewBoard?: () => void }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const now = useNow()
  const { place, cleared, gap } = standing
  const headline = place === 1 ? (cleared > 1 ? "Yours is the fastest time today." : "You are the first to clear it today.")
    : place !== null ? `You placed ${ordinal(place)} of the ${cleared} who have cleared it today.`
    : "This time isn't on today's leaderboard."
  return (
    <section className={`${styles.card} flex flex-col items-center gap-4 sm:gap-5 p-5 sm:p-6 w-full text-center cursor-default ${theme.textBody}`}>
      <span className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white ring-8 ring-green-500/20">
        <Trophy className="w-6 h-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-green-500">{fresh ? "Board cleared!" : "Done for today"}</h2>
        <p>{headline}</p>
      </div>
      <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-left">
        <GameResultItem label="Time">{formatScore(standing.durationMs)}</GameResultItem>
        <GameResultItem label="Place">{place !== null ? `${ordinal(place)} of ${cleared}` : "—"}</GameResultItem>
        <GameResultItem label="Mines hit">{standing.mineHits}</GameResultItem>
        <GameResultItem label={gap?.label ?? "Behind 1st"}>{gap ? formatScore(gap.ms) : "—"}</GameResultItem>
      </div>
      {onViewBoard && (
        <button className={`${styles.ghost} inline-flex items-center gap-2`} onClick={onViewBoard}>
          <Eye className="w-4 h-4" />
          Look at the board
        </button>
      )}
      <p className="text-sm opacity-70">The next board arrives in {formatCountdown(msUntilNextUtcDay(now))}.</p>
    </section>
  )
}

// A signed-in player's go at today's board
function DailyGame({ info, onChanged, onBoard }: { info: DailyInfo, onChanged: () => void, onBoard: boolean }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const connection = useConnection()
  const { session, refreshProfile } = useAccount()
  const { compact, short, touch } = useLayout()
  const daily = ownGameIn(connection, "daily")
  // how long they took, once they have cleared it
  const finishedMs = daily?.durationMs ?? null

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
  if (daily && onBoard) {
    const playableBoard = <LiveBoard game={daily} centered onReveal={connection.reveal} onFlag={connection.flag} />
    const figure = `text-sm font-bold leading-5 tabular-nums ${theme.textHead}`
    // the same three figures on every screen: in a strip over the board on a small one, in the bar every board has
    // over it on a big one
    const status = (
      <GameBar icon={<Activity className="w-4 h-4" />} label="Daily" vertical={compact && short} columns={compact ? 3 : undefined}>
        <BarField label="Time" vertical={compact && short}>
          <span className={figure}><GameClock startedAt={daily.startedAt} durationMs={finishedMs} /></span>
        </BarField>
        <BarField label="Uncovered" vertical={compact && short}>
          <span className={`${figure} ${finishedMs !== null ? "text-green-500!" : ""}`}>{daily.percent}%</span>
        </BarField>
        <BarField label="Mines hit" vertical={compact && short}>
          <span className={figure}>{daily.mineHits}</span>
        </BarField>
      </GameBar>
    )
    if (compact) {
      return <BoardStage status={status} dock={touch ? <Dock><FlagToggle /></Dock> : undefined}>{playableBoard}</BoardStage>
    }
    // in the middle of the page, under its figures, as the singleplayer board is
    return (
      <div className="flex flex-col items-center gap-5">
        {status}
        {playableBoard}
      </div>
    )
  }

  // Cleared: just now, or earlier today. The server's account of it is a moment behind the board being cleared,
  // and until it arrives what the game itself said stands in for it
  const userId = session?.user.id ?? ""
  const standing = dailyStanding(info, userId)
    ?? (daily && finishedMs !== null ? { durationMs: finishedMs, mineHits: daily.mineHits, place: null, cleared: info.cleared, gap: null } : null)
  if (standing) {
    const waiting = info.mine?.durationMs == null
    const recordId = info.mine?.recordId
    return waiting
      ? <section className={`${styles.card} p-6 w-full text-center opacity-70 cursor-default ${theme.textBody}`}>Cleared in {formatScore(standing.durationMs)}. Working out where that puts you…</section>
      : <DailyResult standing={standing} fresh={daily?.outcome === "cleared"} onViewBoard={recordId != null ? () => navigate("history", userId, recordId) : undefined} />
  }

  const startError = connection.error?.action === "startSolo" ? connection.error.message : null
  return (
    <section className={`${styles.card} flex flex-col items-start gap-3 p-4 w-full ${theme.textBody}`}>
      <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Today's board: {boardSize(info.settings)}</h2>
      <p className="cursor-default">
        Everyone gets the same board today. Your clock starts when you press Start and doesn't stop until the board
        is cleared, even if you leave and come back. Hitting a mine covers back up what you had uncovered around it.
      </p>
      {info.cleared > 0 && <p className="text-sm opacity-70 cursor-default">{plural(info.cleared, "player")} {info.cleared === 1 ? "has" : "have"} cleared it so far.</p>}
      {info.mine && <p className="font-semibold cursor-default">Your clock is already running.</p>}
      <button className={`${styles.primary} px-6! max-sm:w-full`} disabled={connection.status !== "connected"} onClick={() => connection.startSolo("daily")}>
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
  // today's board is on the screen, being played: it has the page to itself until it is cleared
  const onBoard = useDailyOnBoard() && Boolean(session)
  const [info, setInfo] = useState<DailyInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const userId = session?.user.id

  const load = useCallback(() => {
    getDaily().then(loaded => { setInfo(loaded); setError(null) }, (e: Error) => setError(e.message))
  }, [])
  // again when who is signed in changes: the answer includes their own go
  useEffect(load, [load, userId])

  return (
    <Page
      title="Daily challenge"
      aside={info && <span className={`text-sm opacity-70 ${theme.textBody}`}>{info.date}</span>}
      maxWidth={onBoard ? "max-w-none" : "max-w-2xl"}
      // on a small screen the board pans about in the height there is
      fill={compact && onBoard}
    >
        {error && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}

        {info && !isPending && (
          <>
            {session ? (
              // keyed by account, so signing in as someone else starts a fresh connection as them
              <DailyGame key={session.user.id} info={info} onChanged={load} onBoard={onBoard} />
            ) : (
              <section className={`${styles.card} flex flex-col items-start gap-3 p-4 w-full ${theme.textBody}`}>
                <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Today's board: {boardSize(info.settings)}</h2>
                <p className="cursor-default">One board a day, the same for everyone, against the clock. You need an account to play it.</p>
                <div className="flex gap-2">
                  <button className={styles.ghost} onClick={() => onOpenAuth("signIn")}>Log in</button>
                  <button className={styles.primary} onClick={() => onOpenAuth("signUp")}>Sign up</button>
                </div>
              </section>
            )}

            {!onBoard && (
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
