import { useEffect, useRef, type ReactNode } from "react"
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
import RoomList from "./RoomList"
import RoomView from "./RoomView"
import SignedOutMultiplayer from "./SignedOutMultiplayer"

type MultiplayerScreenProps = {
  // a room to walk straight into on arriving, picked from the list in the left pane
  joinRoomId: string | null
  onJoinHandled: () => void
}

// What a signed-in player is looking at in multiplayer, from the outside in
const STAGES = ["rooms", "room", "game"] as const

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
  const { refreshProfile } = useAccount()
  const { leaveRoom } = multiplayer
  useEffect(() => leaveRoom, [leaveRoom])

  // A room picked from the list in the left pane is joined as soon as the connection is up, if it can simply
  // be walked into. (A private one is left for its passcode to be typed, in the list on this page.)
  const { status, rooms, joinRoom } = multiplayer
  useEffect(() => {
    if (!joinRoomId || status !== "connected") return
    const picked = rooms.find(room => room.id === joinRoomId)
    if (picked && picked.visibility === "public" && !picked.inGame) joinRoom(joinRoomId)
    onJoinHandled()
  }, [joinRoomId, status, rooms, joinRoom, onJoinHandled])
  const stage: typeof STAGES[number] = multiplayer.room?.game ? "game" : multiplayer.room ? "room" : "rooms"

  // A sound for someone coming into the room: this player walking into one, or another player joining them there
  const roomId = multiplayer.room?.id ?? null
  const playerCount = multiplayer.room?.players.length ?? 0
  const lastSeen = useRef({ roomId, playerCount, stage })
  useEffect(() => {
    const before = lastSeen.current
    lastSeen.current = { roomId, playerCount, stage }
    if (roomId && (roomId !== before.roomId || playerCount > before.playerCount)) playSound("roomJoin")
    // ...and the screen-change sound for coming back out: a game ending, leaving the room
    if (STAGES.indexOf(stage) < STAGES.indexOf(before.stage)) playSound("transition")
    // a game that is over has just been scored: fetch the player's level and rating again in a moment
    if (before.stage === "game" && stage !== "game") setTimeout(refreshProfile, 1000)
  }, [roomId, playerCount, stage, refreshProfile])

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
          {multiplayer.room?.game ? (
            <GameView room={multiplayer.room} game={multiplayer.room.game} multiplayer={multiplayer} />
          ) : multiplayer.room ? (
            <RoomView room={multiplayer.room} multiplayer={multiplayer} />
          ) : (
            <div className="flex flex-wrap items-start gap-4">
              <CreateRoomForm multiplayer={multiplayer} />
              <RoomList multiplayer={multiplayer} />
            </div>
          )}
        </ViewTransition>
      </PageBody>

      {/* stays put along the bottom while in the room; out of the way once a game is on */}
      {multiplayer.room && !multiplayer.room.game && <ChatDock multiplayer={multiplayer} />}
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
