import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { API_URL } from "../lib/authClient"
import {
  CLOSE_REPLACED,
  type BoardSettings, type ChatMessage, type ClientMessage, type DailyState, type RoomDetail, type RoomSummary, type RoomVisibility, type ServerMessage,
} from "../../shared/protocol"

const SOCKET_URL = `${(API_URL || window.location.origin).replace(/^http/, "ws")}/api/ws`

// "replaced": this account opened multiplayer somewhere else, which took the connection over
export type MultiplayerStatus = "connecting" | "connected" | "replaced"

export type MultiplayerError = { action: ClientMessage["type"], message: string }

// This player's own board in the game being played, as the server last sent it
export type OwnBoard = {
  // one character per cell, row after row (see shared/protocol.ts)
  cells: string
  // the moment (this browser's clock) they can play again after uncovering a mine
  cooldownUntil: number
}

// The live connection to the game server, held for as long as someone is signed in (`userId`; null means nobody is,
// and then there is no connection). One is opened for the whole app: see ConnectionContext.
// The server is the source of truth: it sends the list of rooms, the room this player is in, their go at the
// daily challenge, their board in whichever game they are playing, and what is said in the chats, as they change
export function useMultiplayer(userId: string | null) {
  const [status, setStatus] = useState<MultiplayerStatus>("connecting")
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [room, setRoom] = useState<RoomDetail | null>(null)
  const [error, setError] = useState<MultiplayerError | null>(null)
  // something the player should know that they didn't ask for: being removed from a room
  const [notice, setNotice] = useState<string | null>(null)
  const [board, setBoard] = useState<OwnBoard | null>(null)
  // what has been said in the room this player is in, oldest first
  const [chat, setChat] = useState<ChatMessage[]>([])
  // what has been said in the chat everyone shares, oldest first
  const [globalChat, setGlobalChat] = useState<ChatMessage[]>([])
  // when play begins in the game being played, by this browser's clock: a few seconds ahead while it counts down
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null)
  // this player's go at the daily challenge while they are playing it, and when its clock started (this browser's clock)
  const [daily, setDaily] = useState<DailyState | null>(null)
  const [dailyStartedAt, setDailyStartedAt] = useState<number | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  // bumped to connect afresh after being replaced
  const [connectionAttempt, setConnectionAttempt] = useState(0)

  useEffect(() => {
    if (!userId) return
    // set once this effect is cleaned up, so nothing from its sockets is acted on afterwards
    let finished = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let failures = 0

    const open = () => {
      setStatus("connecting")
      const socket = new WebSocket(SOCKET_URL)
      socketRef.current = socket

      socket.onopen = () => {
        if (finished) return
        failures = 0
        setStatus("connected")
      }
      socket.onmessage = (event) => {
        if (finished) return
        const message = JSON.parse(event.data) as ServerMessage
        if (message.type === "rooms") setRooms(message.rooms)
        if (message.type === "error") setError({ action: message.action, message: message.message })
        if (message.type === "kicked") setNotice(`The host removed you from "${message.roomName}".`)
        if (message.type === "board") setBoard({ cells: message.cells, cooldownUntil: Date.now() + message.cooldownMs })
        if (message.type === "chatHistory") setChat(message.messages)
        if (message.type === "globalChatHistory") setGlobalChat(message.messages)
        if (message.type === "globalChat") setGlobalChat(messages => [...messages, message.message])
        if (message.type === "daily") {
          const state = message.daily
          setDaily(state)
          setDailyStartedAt(startedAt => state ? startedAt ?? Date.now() - state.elapsedMs : null)
        }
        if (message.type === "chat") setChat(messages => [...messages, message.message])
        if (message.type === "room") {
          const game = message.room?.game
          setRoom(message.room)
          setGameStartedAt(startedAt => game ? startedAt ?? Date.now() - game.elapsedMs : null)
          if (!game) setBoard(null)
          if (!message.room) setChat([])
        }
      }
      socket.onclose = (event) => {
        if (finished) return
        // whatever room this player was in, the server has taken them out of it
        setRoom(null)
        setRooms([])
        setBoard(null)
        setChat([])
        setGameStartedAt(null)
        setDaily(null)
        setDailyStartedAt(null)
        if (event.code === CLOSE_REPLACED) {
          setStatus("replaced")
          return
        }
        // dropped (or the server restarted): keep trying, a little slower each time
        setStatus("connecting")
        retryTimer = setTimeout(open, Math.min(1000 * 2 ** failures, 10_000))
        failures++
      }
    }
    open()

    return () => {
      finished = true
      clearTimeout(retryTimer)
      socketRef.current?.close()
      // whoever signs in next starts from nothing
      setRoom(null)
      setRooms([])
      setBoard(null)
      setChat([])
      setGlobalChat([])
      setGameStartedAt(null)
      setDaily(null)
      setDailyStartedAt(null)
      setNotice(null)
      setError(null)
    }
  }, [connectionAttempt, userId])

  const send = useCallback((message: ClientMessage) => {
    setError(null)
    // anything the player goes on to do in the list of rooms puts the notice behind them
    if (message.type === "createRoom" || message.type === "joinRoom") setNotice(null)
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
    setSettings: (settings: BoardSettings) => send({ type: "setSettings", settings }),
    startGame: () => send({ type: "startGame" }),
    endGame: () => send({ type: "endGame" }),
    startDaily: () => send({ type: "startDaily" }),
    reveal: (row: number, col: number) => send({ type: "reveal", row, col }),
    flag: (row: number, col: number) => send({ type: "flag", row, col }),
    reconnect: () => setConnectionAttempt(attempt => attempt + 1),
  }), [send])

  return { status, rooms, room, error, notice, board, chat, globalChat, gameStartedAt, daily, dailyStartedAt, ...actions }
}

export type Multiplayer = ReturnType<typeof useMultiplayer>
