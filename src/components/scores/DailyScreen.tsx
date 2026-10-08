import { useCallback, useEffect, useState } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useConnection } from "../../context/ConnectionContext"
import type { AuthMode } from "../../game/types"
import { getDaily, type DailyInfo } from "../../lib/api"
import { formatScore } from "../../lib/time"
import { NAV_SPACE } from "../app/MainNavigation"
import { GameClock } from "../multiplayer/GameView"
import PlayableBoard from "../multiplayer/PlayableBoard"
import ScoreTable from "./ScoreTable"

const describe = ({ rows, cols, mines }: DailyInfo["settings"]) => `${rows} × ${cols}, ${mines} mines`

// A signed-in player's go at today's board
function DailyGame({ info, onChanged }: { info: DailyInfo, onChanged: () => void }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const multiplayer = useConnection()
  const { refreshProfile } = useAccount()
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
  if (daily && board) {
    return (
      <>
        <section className={`${styles.card} flex flex-wrap items-center gap-x-6 gap-y-3 p-4 cursor-default ${theme.textBody}`}>
          <span className="font-semibold"><GameClock startedAt={multiplayer.dailyStartedAt} finishedMs={finishedMs} /></span>
          <span className="font-semibold">{daily.percent}% uncovered</span>
          {daily.mineHits > 0 && <span className="font-semibold">{daily.mineHits} {daily.mineHits === 1 ? "mine" : "mines"} hit</span>}
          {finishedMs !== null && <span className="font-semibold text-green-500">Cleared in {formatScore(finishedMs)}</span>}
        </section>
        <PlayableBoard
          settings={daily.settings}
          ownBoard={board}
          startsAt={multiplayer.dailyStartedAt}
          start={daily.start}
          finished={finishedMs !== null}
          onReveal={multiplayer.reveal}
          onFlag={multiplayer.flag}
        />
      </>
    )
  }

  // cleared earlier today
  if (info.mine && info.mine.durationMs !== null) {
    return (
      <section className={`${styles.card} flex flex-col gap-2 p-4 w-full max-w-md cursor-default ${theme.textBody}`}>
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
    <section className={`${styles.card} flex flex-col items-start gap-3 p-4 w-full max-w-md ${theme.textBody}`}>
      <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Today's board: {describe(info.settings)}</h2>
      <p className="cursor-default">
        Everyone gets the same board today. Your clock starts when you press Start and doesn't stop until the board
        is cleared, even if you leave and come back. Hitting a mine costs you three seconds.
      </p>
      {info.mine && <p className="font-semibold cursor-default">Your clock is already running.</p>}
      <button className={`${styles.button} px-6`} disabled={multiplayer.status !== "connected"} onClick={multiplayer.startDaily}>
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
  const [info, setInfo] = useState<DailyInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const userId = session?.user.id

  const load = useCallback(() => {
    getDaily().then(loaded => { setInfo(loaded); setError(null) }, (e: Error) => setError(e.message))
  }, [])
  // again when who is signed in changes: the answer includes their own go
  useEffect(load, [load, userId])

  return (
    <div className={`h-full overflow-y-auto overflow-x-hidden hide-scrollbar ${theme.background}`} style={{ paddingLeft: NAV_SPACE }}>
      <div className="flex flex-col gap-4 py-4 pl-2 pr-4">
        <div className="flex items-baseline gap-3 cursor-default">
          <h1 className={`text-2xl font-semibold ${theme.textHead}`}>Daily challenge</h1>
          {info && <span className={`text-sm opacity-70 ${theme.textBody}`}>{info.date}</span>}
        </div>
        {error && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}

        {info && !isPending && (
          <>
            {session ? (
              // keyed by account, so signing in as someone else starts a fresh connection as them
              <DailyGame key={session.user.id} info={info} onChanged={load} />
            ) : (
              <section className={`${styles.card} flex flex-col items-start gap-3 p-4 w-full max-w-md ${theme.textBody}`}>
                <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Today's board: {describe(info.settings)}</h2>
                <p className="cursor-default">One board a day, the same for everyone, against the clock. You need an account to play it.</p>
                <div className="flex gap-2">
                  <button className={styles.button} onClick={() => onOpenAuth("signIn")}>Log in</button>
                  <button className={styles.button} onClick={() => onOpenAuth("signUp")}>Sign up</button>
                </div>
              </section>
            )}

            <section className={`${styles.card} overflow-hidden w-full max-w-2xl`}>
              <h2 className={`p-4 text-xl font-semibold cursor-default ${theme.textHead}`}>Today's times</h2>
              <ScoreTable entries={info.entries} emptyText="Nobody has cleared today's board yet." highlightUserId={userId} />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
