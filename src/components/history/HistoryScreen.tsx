import { useEffect, useState } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import type { AuthMode } from "../../game/types"
import { useFormStyles } from "../../hooks/useFormStyles"
import { navigate } from "../../hooks/useRoute"
import { getHistory, type HistoryGame } from "../../lib/api"
import { avatarSrc } from "../../lib/avatar"
import { describeBoard, describeOutcome } from "../../lib/gameResults"
import { NAV_SPACE } from "../app/MainNavigation"
import ReplayView from "./ReplayView"

const KINDS: Record<HistoryGame["kind"], string> = { singleplayer: "Singleplayer", multiplayer: "Multiplayer", daily: "Daily challenge" }

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

  const headClass = `px-4 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${theme.textHead}`
  const cellClass = "px-4 py-2.5 whitespace-nowrap"

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

      {history && history.games.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className={`border-y ${theme.itemBorder} ${theme.itemBg}`}>
                <th className={headClass}>When</th>
                <th className={headClass}>Game</th>
                <th className={headClass}>Board</th>
                <th className={headClass}>Result</th>
                <th className={`${headClass} text-right`}>Mines hit</th>
                <th className={`${headClass} text-right`}>Moves</th>
                <th className={headClass} />
              </tr>
            </thead>
            <tbody>
              {history.games.map(game => (
                <tr
                  key={game.id}
                  className={`border-b last:border-b-0 cursor-pointer ${theme.itemBorder} ${theme.itemHoverBg}`}
                  onClick={() => navigate("history", ownerId, game.id)}
                >
                  <td className={cellClass}>{new Date(game.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className={cellClass}>
                    {KINDS[game.kind]}
                    {game.rated && <span className={`${styles.tag} ml-2`}>Rated</span>}
                  </td>
                  <td className={cellClass}>{describeBoard(game)}</td>
                  <td className={`${cellClass} tabular-nums ${game.outcome === "cleared" ? "font-bold" : ""}`}>{describeOutcome(game.outcome, game.durationMs)}</td>
                  <td className={`${cellClass} text-right tabular-nums`}>{game.mineHits}</td>
                  <td className={`${cellClass} text-right tabular-nums`}>{game.moves}</td>
                  <td className={`${cellClass} text-right font-semibold`}>Watch</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

  return (
    <div className={`h-full overflow-y-auto hide-scrollbar ${theme.background}`} style={{ paddingLeft: NAV_SPACE }}>
      <div className="flex flex-col gap-4 py-4 pl-2 pr-4">
        <h1 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>Match history</h1>
        {isPending ? null : !session || !ownerId ? (
          <div className={`${styles.card} flex flex-col items-start gap-3 p-4 max-w-md cursor-default ${theme.textBody}`}>
            <p>Games you play while signed in are kept here, and you can watch any of them back, move by move.</p>
            <button className={styles.button} onClick={() => onOpenAuth("signIn")}>Log in</button>
          </div>
        ) : gameId !== null ? (
          <ReplayView gameId={gameId} onBack={() => navigate("history", ownerId)} />
        ) : (
          <GameList ownerId={ownerId} isOwn={ownerId === session.user.id} />
        )}
      </div>
    </div>
  )
}
