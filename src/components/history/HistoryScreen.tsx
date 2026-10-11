import { useEffect, useState } from "react"
import { Bomb, CalendarCheck, CalendarDays, ChevronRight, Minus, Swords, Trophy } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import type { AuthMode } from "../../game/types"
import { useFormStyles } from "../../hooks/useFormStyles"
import { navigate } from "../../hooks/useRoute"
import { getHistory, type HistoryGame } from "../../lib/api"
import { avatarSrc } from "../../lib/avatar"
import { MEDALS, ordinal, verdictOf } from "../../lib/gameResults"
import { boardName } from "../../../shared/game/boards"
import { gameName } from "../../../shared/game/modes"
import Page from "../app/Page"
import ReplayView from "./ReplayView"
import { plural } from "../../lib/text"

type HistoryScreenProps = {
  // whose history: the signed-in player's own, unless the address names someone else
  userId: string | null
  // the game of theirs to play back, if the address names one
  gameId: number | null
  onOpenAuth: (mode: AuthMode) => void
}

type Loaded = { player: { id: string, username: string, image: string | null }, games: HistoryGame[], more: boolean }

// A player's games, newest first, each of which can be played back
function GameList({ ownerId, isOwn }: { ownerId: string, isOwn: boolean }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const [history, setHistory] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    setHistory(null)
    getHistory(ownerId)
      .then(loaded => { if (!cancelled) { setHistory(loaded); setError(null) } })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [ownerId])

  function loadMore() {
    if (!history) return
    setLoadingMore(true)
    getHistory(ownerId, history.games[history.games.length - 1].id)
      .then(next => setHistory({ ...next, games: [...history.games, ...next.games] }), (e: Error) => setError(e.message))
      .finally(() => setLoadingMore(false))
  }

  const when = (game: HistoryGame) => new Date(game.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  const tones = { good: "text-green-500", bad: "text-red-500", plain: "" }
  const marks = { good: "bg-green-500/15 text-green-500", bad: "bg-red-500/15 text-red-500", plain: `${theme.itemBg} opacity-80` }

  // What is at the head of a row, so a column of them can be read at a glance: the place they came in a multiplayer
  // game (a medal for the first three), and otherwise a sign for how the game ended, in the colour of that
  function mark(game: HistoryGame, tone: "good" | "bad" | "plain") {
    const frame = "shrink-0 flex items-center justify-center w-10 h-10 rounded-lg text-sm font-extrabold tabular-nums"
    if (game.kind === "multiplayer" && game.place !== null && (game.players ?? 0) > 1) {
      // a medal is for a board that was cleared: a place come by giving up is only a place
      const look = game.outcome === "cleared" ? MEDALS[game.place - 1] ?? marks.plain : marks.bad
      return <span className={`${frame} ${look}`}>{ordinal(game.place)}</span>
    }
    const Icon = game.kind === "daily" ? (tone === "good" ? CalendarCheck : CalendarDays)
      : game.kind === "multiplayer" ? Swords
      : tone === "good" ? Trophy : tone === "bad" ? Bomb : Minus
    return <span className={`${frame} ${marks[tone]}`}><Icon className="w-5 h-5" /></span>
  }

  // how far a multiplayer game moved their rating
  function rating(game: HistoryGame) {
    if (game.kind !== "multiplayer") return null
    const change = game.ratingChange
    if (change === null) return <span className="text-xs opacity-50">{game.rated ? "–" : "Unrated"}</span>
    return (
      <>
        <span className={`block text-base font-bold tabular-nums ${change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "opacity-70"}`}>
          {change > 0 ? `+${change}` : change < 0 ? `−${-change}` : "±0"}
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-60">Rating</span>
      </>
    )
  }

  return (
    <section className={`${styles.card} overflow-hidden cursor-default ${theme.textBody}`}>
      <div className="flex items-center gap-3 p-4">
        {history && <img src={avatarSrc(history.player.image)} alt="" referrerPolicy="no-referrer" className={`w-9 h-9 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`} />}
        <div>
          <h2 className={`text-xl font-semibold ${theme.textHead}`}>{isOwn ? "Your games" : history ? `@${history.player.username}'s games` : "Games"}</h2>
          <p className="text-sm opacity-70">Every game the server ran, newest first. Pick one to watch it back.</p>
        </div>
      </div>

      {error && <p role="alert" className="px-4 pb-4 text-sm text-red-500 font-semibold">{error}</p>}
      {!history && !error && <p className="px-4 pb-4 text-sm opacity-70">Loading…</p>}
      {history && history.games.length === 0 && (
        <p className="px-4 pb-4 opacity-70">{isOwn ? "No games yet. Play one while signed in and it will be here." : "No games to show yet."}</p>
      )}

      {/* A row is read left to right as: how it went, what it was, what it came to, and what it did to their rating.
          On a phone the middle two go one under the other */}
      {history?.games.map((game) => {
        const verdict = verdictOf(game)
        return (
          <button
            key={game.id}
            className={`w-full flex items-center gap-3 sm:gap-4 px-4 py-3.5 border-t text-left cursor-pointer ${theme.itemBorder} ${theme.itemHoverBg}`}
            title="Watch this game back"
            onClick={() => navigate("history", ownerId, game.id)}
          >
            {mark(game, verdict.tone)}
            <span className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-6">
              <span className="block sm:flex-1 min-w-0">
                {/* on a phone the name of the game is never cut short: its label drops under it instead */}
                <span className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold ${theme.textHead}`}>
                  <span className="sm:truncate">{gameName(game.mode)} · {boardName(game)}</span>
                  {game.rated && <span className={styles.tag}>Rated</span>}
                </span>
                <span className="block text-xs opacity-70 truncate">{when(game)} · {plural(game.moves, "move")}</span>
              </span>
              <span className="block sm:w-60 sm:shrink-0 max-sm:mt-1.5">
                <span className={`block font-bold truncate ${tones[verdict.tone] || theme.textHead}`}>{verdict.word}</span>
                <span className="block text-xs opacity-70 tabular-nums truncate">{verdict.detail}</span>
              </span>
            </span>
            <span className="shrink-0 w-14 sm:w-16 text-right">{rating(game)}</span>
            <ChevronRight className="w-4 h-4 shrink-0 opacity-60" />
          </button>
        )
      })}

      {history?.more && (
        <div className={`p-3 border-t ${theme.itemBorder}`}>
          <button className={styles.ghost} disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Loading…" : "Show older games"}</button>
        </div>
      )}
    </section>
  )
}

// The match history: a player's games, and any one of them played back. It takes the game's place beside the left pane
export default function HistoryScreen({ userId, gameId, onOpenAuth }: HistoryScreenProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session, isPending } = useAccount()
  const ownerId = userId ?? session?.user.id ?? null

  // a game being played back on a small screen takes the page over, as a game being played does
  const watching = Boolean(session && ownerId) && gameId !== null
  return (
    <Page title="Match history" maxWidth={watching ? "max-w-none" : undefined} fill={watching}>
        {isPending ? null : !session || !ownerId ? (
          <div className={`${styles.card} flex flex-col items-start gap-3 p-4 max-w-md cursor-default ${theme.textBody}`}>
            <p>
              {gameId !== null ? "This is a link to a replay of someone's game. Log in to watch it."
                : userId ? "This is a player's match history. Log in to see their games and watch them back."
                : "Games you play while signed in are kept here, and you can watch any of them back, move by move."}
            </p>
            <button className={styles.button} onClick={() => onOpenAuth("signIn")}>Log in</button>
          </div>
        ) : gameId !== null ? (
          <ReplayView gameId={gameId} onBack={() => navigate("history", ownerId)} />
        ) : (
          <GameList ownerId={ownerId} isOwn={ownerId === session.user.id} />
        )}
    </Page>
  )
}
