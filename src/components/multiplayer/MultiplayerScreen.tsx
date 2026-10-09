import { useEffect, useRef, useState } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useConnection } from "../../context/ConnectionContext"
import { useLayout } from "../../hooks/useLayout"
import { playSound } from "../../lib/sounds"
import FloatingWindow from "../app/FloatingWindow"
import Page from "../app/Page"
import ViewTransition from "../app/ViewTransition"
import ChatDock from "./ChatDock"
import CreateRoomForm from "./CreateRoomForm"
import GameView from "./GameView"
import ResultsView from "./ResultsView"
import RoomList from "./RoomList"
import RoomView from "./RoomView"
import SignedOutMultiplayer from "./SignedOutMultiplayer"
import SpectateView from "./SpectateView"

// What a signed-in player is looking at in multiplayer, from the outside in
const STAGES = ["rooms", "room", "game", "results", "watching"] as const

// Where a player whose own game is over has chosen to be: at the results (where they start), back in the room,
// or watching one of the others
type AfterGame = { place: "results" } | { place: "room" } | { place: "watching", playerId: string }

// A board that has just been cleared stays up this long, for its win to play out, before the results take its place
const WIN_HOLD_MS = 1600

// The rooms to join, the room this player is in, or the game being played there.
// Leaving the multiplayer page leaves the room
function Lobby() {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const multiplayer = useConnection()
  const { session, refreshProfile } = useAccount()
  const { mode, compact } = useLayout()
  // On a phone the form for a new room is a sheet brought up from the list, rather than a card above it
  const [creating, setCreating] = useState(false)
  // ...which has done its job once there is a room to be in
  if (creating && multiplayer.room) setCreating(false)
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
    // ...one for someone going out of it: this player leaving the room, or another player leaving them in it
    const left = before.roomId !== null && (roomId === null || (roomId === before.roomId && playerCount < before.playerCount))
    if (left) playSound("roomLeave")
    // ...and the screen-change sound for coming back out: from someone's board to the results, from there to the room.
    // (Out of the room altogether has just had its own.)
    else if (STAGES.indexOf(stage) < STAGES.indexOf(before.stage)) playSound("transition")
    // a game that is over has just been scored: fetch the player's level and rating again in a moment
    if (gameOver && !before.gameOver) setTimeout(refreshProfile, 1500)
  }, [roomId, playerCount, stage, gameOver, refreshProfile])

  // ...and one for the server refusing something (a wrong passcode, a room that's gone)
  useEffect(() => {
    if (multiplayer.error || multiplayer.notice) playSound("error")
  }, [multiplayer.error, multiplayer.notice])

  if (multiplayer.status === "replaced") {
    return (
      <Page title="Multiplayer">
        <div className={`${styles.card} flex flex-col items-start gap-4 p-4 w-full max-w-sm`}>
          <p className={`cursor-default ${theme.textBody}`}>Multiplayer was opened with this account in another tab or on another device.</p>
          <button className={styles.button} onClick={multiplayer.reconnect}>Use it here instead</button>
        </div>
      </Page>
    )
  }

  // a board on a small screen takes the page over: it lays itself out in the room there is
  const onBoard = stage === "game" || stage === "watching"
  return (
      <Page
        title="Multiplayer"
        // a board, with the other players either side of it, has the whole width
        maxWidth={onBoard ? "max-w-none" : undefined}
        fill={onBoard}
        // stays put along the bottom in the room and at the results; out of the way wherever there is a board
        footer={(stage === "room" || stage === "results") && <ChatDock multiplayer={multiplayer} />}
      >
        {multiplayer.status === "connecting" && !(onBoard && compact) && (
          <p className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>Connecting…</p>
        )}
        {multiplayer.notice && <p role="alert" className={`text-sm text-red-500 font-semibold cursor-default ${onBoard && compact ? "px-3 pt-2" : ""}`}>{multiplayer.notice}</p>}
        {/* creating or joining a room, starting a game, and going back again each ease the new view in */}
        <ViewTransition view={stage} order={STAGES} className={onBoard && compact ? "flex-1 min-h-0" : `flex flex-col ${mode === "phone" ? "gap-3" : "gap-4"}`}>
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
          ) : mode === "phone" ? (
            // the rooms come first on a phone: they are what most people are here for
            <>
              <RoomList multiplayer={multiplayer} onCreate={() => setCreating(true)} />
              {creating && (
                <FloatingWindow title="Create a room" sheet className="w-[min(26rem,94vw)]" onClose={() => setCreating(false)}>
                  <CreateRoomForm multiplayer={multiplayer} bare />
                </FloatingWindow>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-start gap-4">
              <CreateRoomForm multiplayer={multiplayer} />
              <RoomList multiplayer={multiplayer} />
            </div>
          )}
        </ViewTransition>
      </Page>
  )
}

// The multiplayer part of the site. It takes the game's place beside the left pane
export default function MultiplayerScreen() {
  const { session, isPending } = useAccount()

  if (isPending) return <Page title="Multiplayer">{null}</Page>
  // keyed by account, so signing in as someone else starts a fresh connection as them
  if (session) return <Lobby key={session.user.id} />
  return (
    <Page title="Multiplayer">
      <SignedOutMultiplayer />
    </Page>
  )
}
