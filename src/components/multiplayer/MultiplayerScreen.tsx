import { useEffect, useRef, useState, type ReactNode } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useConnection } from "../../context/ConnectionContext"
import { playSound } from "../../lib/sounds"
import { NAV_SPACE } from "../app/MainNavigation"
import ViewTransition from "../app/ViewTransition"
import ChatDock from "./ChatDock"
import CreateRoomForm from "./CreateRoomForm"
import GameView from "./GameView"
import ResultsView from "./ResultsView"
import RoomList from "./RoomList"
import RoomView from "./RoomView"
import SignedOutMultiplayer from "./SignedOutMultiplayer"
import SpectateView from "./SpectateView"

type MultiplayerScreenProps = {
  // a room to walk straight into on arriving, picked from the list in the left pane
  joinRoomId: string | null
  onJoinHandled: () => void
}

// What a signed-in player is looking at in multiplayer, from the outside in
const STAGES = ["rooms", "room", "game", "results", "watching"] as const

// Where a player whose own game is over has chosen to be: at the results (where they start), back in the room,
// or watching one of the others
type AfterGame = { place: "results" } | { place: "room" } | { place: "watching", playerId: string }

// A board that has just been cleared stays up this long, for its win to play out, before the results take its place
const WIN_HOLD_MS = 1600

// The part of the page that scrolls, under its heading
function PageBody({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hide-scrollbar">
      <div className="flex flex-col gap-4 py-4 pl-2 pr-4">
        <h1 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>Multiplayer</h1>
        {children}
      </div>
    </div>
  )
}

// The rooms to join, the room this player is in, or the game being played there.
// Leaving the multiplayer page leaves the room
function Lobby({ joinRoomId, onJoinHandled }: MultiplayerScreenProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const multiplayer = useConnection()
  const { session, refreshProfile } = useAccount()
  const { leaveRoom, spectate } = multiplayer
  useEffect(() => leaveRoom, [leaveRoom])

  const room = multiplayer.room
  const game = room?.game ?? null
  const gameId = game?.id ?? null
  const myId = session?.user.id
  // how this player's own game stands; null if they aren't in the room's game (they joined after it ended)
  const outcome = game && myId ? game.progress[myId]?.outcome ?? null : null
  const [afterGame, setAfterGame] = useState<AfterGame>({ place: "results" })
  const [holdingBoard, setHoldingBoard] = useState(false)

  const lastGame = useRef({ gameId, outcome })
  useEffect(() => {
    const before = lastGame.current
    lastGame.current = { gameId, outcome }
    if (gameId !== before.gameId) {
      // another game, or none: whatever was chosen after the last one goes with it
      setAfterGame({ place: "results" })
      setHoldingBoard(false)
      return
    }
    // this player's game has just ended, one way or another
    if (before.outcome !== "playing" || outcome === "playing" || outcome === null) return
    setAfterGame({ place: "results" })
    if (outcome !== "cleared") {
      playSound("gameOver")
      return
    }
    setHoldingBoard(true)
    const timer = setTimeout(() => setHoldingBoard(false), WIN_HOLD_MS)
    return () => clearTimeout(timer)
  }, [gameId, outcome])

  function watch(playerId: string) {
    spectate(playerId)
    setAfterGame({ place: "watching", playerId })
  }
  // leaving the board being watched, for the results or the room
  function stopWatching(place: "results" | "room") {
    spectate(null)
    setAfterGame({ place })
  }

  // A room picked from the list in the left pane is joined as soon as the connection is up, if it can simply
  // be walked into. (A private one is left for its passcode to be typed, in the list on this page.)
  const { status, rooms, joinRoom } = multiplayer
  useEffect(() => {
    if (!joinRoomId || status !== "connected") return
    const picked = rooms.find(room => room.id === joinRoomId)
    if (picked && picked.visibility === "public" && !picked.inGame) joinRoom(joinRoomId)
    onJoinHandled()
  }, [joinRoomId, status, rooms, joinRoom, onJoinHandled])
  const stage: typeof STAGES[number] = !room ? "rooms"
    : !game || outcome === null ? "room"
    : outcome === "playing" || holdingBoard ? "game"
    : afterGame.place

  // A sound for someone coming into the room: this player walking into one, or another player joining them there
  const roomId = multiplayer.room?.id ?? null
  const playerCount = multiplayer.room?.players.length ?? 0
  const gameOver = game?.over ?? false
  const lastSeen = useRef({ roomId, playerCount, stage, gameOver })
  useEffect(() => {
    const before = lastSeen.current
    lastSeen.current = { roomId, playerCount, stage, gameOver }
    if (roomId && (roomId !== before.roomId || playerCount > before.playerCount)) playSound("roomJoin")
    // ...and the screen-change sound for coming back out: from someone's board to the results, from there to the room
    if (STAGES.indexOf(stage) < STAGES.indexOf(before.stage)) playSound("transition")
    // a game that is over has just been scored: fetch the player's level and rating again in a moment
    if (gameOver && !before.gameOver) setTimeout(refreshProfile, 1500)
  }, [roomId, playerCount, stage, gameOver, refreshProfile])

  // ...and one for the server refusing something (a wrong passcode, a room that's gone)
  useEffect(() => {
    if (multiplayer.error || multiplayer.notice) playSound("error")
  }, [multiplayer.error, multiplayer.notice])

  if (multiplayer.status === "replaced") {
    return (
      <PageBody>
        <div className={`${styles.card} flex flex-col items-start gap-4 p-4 w-full max-w-sm`}>
          <p className={`cursor-default ${theme.textBody}`}>Multiplayer was opened with this account in another tab or on another device.</p>
          <button className={styles.button} onClick={multiplayer.reconnect}>Use it here instead</button>
        </div>
      </PageBody>
    )
  }

  return (
    <>
      <PageBody>
        {multiplayer.status === "connecting" && (
          <p className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>Connecting…</p>
        )}
        {multiplayer.notice && <p role="alert" className="text-sm text-red-500 font-semibold cursor-default">{multiplayer.notice}</p>}
        {/* creating or joining a room, starting a game, and going back again each ease the new view in */}
        <ViewTransition view={stage} order={STAGES} className="flex flex-col gap-4">
          {room && game && stage === "game" ? (
            <GameView room={room} game={game} multiplayer={multiplayer} />
          ) : room && game && stage === "results" ? (
            <ResultsView room={room} game={game} multiplayer={multiplayer} onBackToRoom={() => stopWatching("room")} onWatch={watch} />
          ) : room && game && afterGame.place === "watching" && stage === "watching" ? (
            <SpectateView game={game} playerId={afterGame.playerId} multiplayer={multiplayer} onBack={() => stopWatching("results")} onWatch={watch} />
          ) : room ? (
            <RoomView
              room={room}
              multiplayer={multiplayer}
              onViewResults={game && outcome !== null ? () => setAfterGame({ place: "results" }) : undefined}
            />
          ) : (
            <div className="flex flex-wrap items-start gap-4">
              <CreateRoomForm multiplayer={multiplayer} />
              <RoomList multiplayer={multiplayer} />
            </div>
          )}
        </ViewTransition>
      </PageBody>

      {/* stays put along the bottom in the room and at the results; out of the way wherever there is a board */}
      {(stage === "room" || stage === "results") && <ChatDock multiplayer={multiplayer} />}
    </>
  )
}

// The multiplayer part of the site. It takes the game's place beside the left pane
export default function MultiplayerScreen({ joinRoomId, onJoinHandled }: MultiplayerScreenProps) {
  const { theme } = useTheme()
  const { session, isPending } = useAccount()

  return (
    <div className={`h-full flex flex-col ${theme.background}`} style={{ paddingLeft: NAV_SPACE }}>
      {isPending ? null : session ? (
        // keyed by account, so signing in as someone else starts a fresh connection as them
        <Lobby key={session.user.id} joinRoomId={joinRoomId} onJoinHandled={onJoinHandled} />
      ) : (
        <PageBody>
          <SignedOutMultiplayer />
        </PageBody>
      )}
    </div>
  )
}
