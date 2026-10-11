import { useCallback, useEffect, useMemo, useReducer, useRef } from "react"
import { API_URL, authClient } from "../lib/authClient"
import { DISCONNECTED, asked, dropped, receive, type ConnectionState, type ConnectionStatus } from "../lib/connection"
import type { RoomModeId, SoloModeId } from "../../shared/game/modes"
import {
  CLOSE_BANNED, CLOSE_OUTDATED, CLOSE_REPLACED, PROTOCOL_VERSION,
  type BoardSettings, type CellPosition, type ClientMessage, type RoomVisibility, type ServerMessage,
} from "../../shared/protocol"

const SOCKET_URL = `${(API_URL || window.location.origin).replace(/^http/, "ws")}/api/ws?v=${PROTOCOL_VERSION}`

// the longest wait between two tries at connecting again
const RETRY_MAX_MS = 10_000

type Change =
  | { type: "received", message: ServerMessage, now: number }
  | { type: "asked", message: ClientMessage }
  | { type: "status", status: ConnectionStatus }
  | { type: "dropped", status: ConnectionStatus }
  | { type: "signedOut" }

function reduce(state: ConnectionState, change: Change): ConnectionState {
  switch (change.type) {
    case "received": return receive(state, change.message, change.now)
    case "asked": return asked(state, change.message)
    case "status": return { ...state, status: change.status }
    case "dropped": return dropped(state, change.status)
    // whoever signs in next starts from nothing
    case "signedOut": return DISCONNECTED
  }
}

// The live connection to the game server, held for as long as someone is signed in (`userId`; null means nobody is,
// and then there is no connection). One is opened for the whole app: see ConnectionContext.
// What the server says is kept as the state in lib/connection.ts; what a player can ask of it is below
export function useServerConnection(userId: string | null) {
  const [state, change] = useReducer(reduce, DISCONNECTED)
  const socketRef = useRef<WebSocket | null>(null)
  // bumped to connect afresh after being replaced
  const [attempt, reconnect] = useReducer((count: number) => count + 1, 0)

  useEffect(() => {
    if (!userId) return
    // set once this effect is cleaned up, so nothing from its sockets is acted on afterwards
    let finished = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let failures = 0

    const open = () => {
      change({ type: "status", status: "connecting" })
      const socket = new WebSocket(SOCKET_URL)
      socketRef.current = socket

      socket.onopen = () => {
        if (finished) return
        failures = 0
        change({ type: "status", status: "connected" })
      }
      socket.onmessage = (event) => {
        if (!finished) change({ type: "received", message: JSON.parse(event.data) as ServerMessage, now: Date.now() })
      }
      socket.onclose = (event) => {
        if (finished) return
        if (event.code === CLOSE_REPLACED) return change({ type: "dropped", status: "replaced" })
        if (event.code === CLOSE_OUTDATED) return change({ type: "dropped", status: "outdated" })
        change({ type: "dropped", status: "connecting" })
        // The account has been banned: its sessions are gone on the server, so it is signed out here too.
        // Signing in again says why
        if (event.code === CLOSE_BANNED) {
          authClient.signOut().catch(() => {})
          return
        }
        // dropped (or the server restarted): keep trying, a little slower each time
        retryTimer = setTimeout(open, Math.min(1000 * 2 ** failures, RETRY_MAX_MS))
        failures++
      }
    }
    open()

    return () => {
      finished = true
      clearTimeout(retryTimer)
      socketRef.current?.close()
      socketRef.current = null
      change({ type: "signedOut" })
    }
  }, [attempt, userId])

  const send = useCallback((message: ClientMessage) => {
    change({ type: "asked", message })
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(message))
  }, [])

  // What a player can ask of the server. These keep their identity between renders
  const actions = useMemo(() => ({
    createRoom: (name: string, visibility: RoomVisibility, passcode?: string) => send({ type: "createRoom", name, visibility, passcode }),
    joinRoom: (roomId: string, passcode?: string) => send({ type: "joinRoom", roomId, passcode }),
    leaveRoom: () => send({ type: "leaveRoom" }),
    makeHost: (playerId: string) => send({ type: "makeHost", playerId }),
    kick: (playerId: string) => send({ type: "kick", playerId }),
    sendChat: (text: string) => send({ type: "chat", text }),
    sendGlobalChat: (text: string) => send({ type: "globalChat", text }),
    setMode: (mode: RoomModeId) => send({ type: "setMode", mode }),
    setSettings: (settings: BoardSettings) => send({ type: "setSettings", settings }),
    startGame: () => send({ type: "startGame" }),
    endGame: () => send({ type: "endGame" }),
    giveUp: () => send({ type: "giveUp" }),
    // watch a player's board, or stop watching (null)
    spectate: (playerId: string | null) => send({ type: "spectate", playerId }),
    // Start a game played alone: one whose board opens on a click with that click and the board it is on,
    // one whose board is dealt with nothing. And put one away, which gives it up if it isn't over
    startSolo: (mode: SoloModeId, request: { settings?: BoardSettings, opening?: CellPosition } = {}) => send({ type: "startSolo", mode, ...request }),
    endSolo: () => send({ type: "endSolo" }),
    reveal: (row: number, col: number) => send({ type: "reveal", row, col }),
    flag: (row: number, col: number) => send({ type: "flag", row, col }),
    reconnect,
  }), [send])

  return useMemo(() => ({ ...state, ...actions }), [state, actions])
}

export type ServerConnection = ReturnType<typeof useServerConnection>
