import { upgradeWebSocket } from "@hono/node-server"
import { Hono } from "hono"
import type { WebSocket, WebSocketServer } from "ws"
import { auth } from "../auth.js"
import { env } from "../env.js"
import { getOrCreateProfile } from "../profile.js"
import type { Player } from "../../../shared/protocol.js"
import { connect, disconnect, handleMessage, type Connection } from "./lobby.js"

const SOCKET_OPEN = 1

// The multiplayer WebSocket: one per signed-in player, at /api/ws
export const multiplayerSocket = new Hono<{ Variables: { player: Player } }>().get(
  "/ws",
  async (c, next) => {
    // A browser sends an account's cookies with a WebSocket request from any site,
    // so a connection is only accepted from the game's own pages
    if (c.req.header("Origin") !== env.clientOrigin) return c.json({ error: "Forbidden" }, 403)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: "Not signed in" }, 401)

    const { username } = await getOrCreateProfile(session.user)
    c.set("player", { id: session.user.id, username, image: session.user.image ?? null })
    await next()
  },
  upgradeWebSocket((c) => {
    const player = c.get("player")
    let connection: Connection | undefined

    return {
      onOpen(_event, socket) {
        connection = connect(player, {
          send: (message) => {
            if (socket.readyState === SOCKET_OPEN) socket.send(JSON.stringify(message))
          },
          close: (code, reason) => socket.close(code, reason),
        })
      },
      onMessage(event) {
        if (connection && typeof event.data === "string") handleMessage(connection, event.data)
      },
      onClose() {
        if (connection) disconnect(connection)
      },
    }
  }),
)

// A connection that vanishes without saying goodbye (a laptop lid closing, wifi dropping) would otherwise
// stay in its room forever. Each one is pinged regularly and dropped if it didn't answer the previous ping
export function dropDeadConnections(sockets: WebSocketServer, everyMs = 30_000) {
  const answered = new WeakMap<WebSocket, boolean>()

  sockets.on("connection", (socket) => {
    answered.set(socket, true)
    socket.on("pong", () => answered.set(socket, true))
  })

  const timer = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!answered.get(socket)) {
        socket.terminate()
        continue
      }
      answered.set(socket, false)
      socket.ping()
    }
  }, everyMs)
  sockets.on("close", () => clearInterval(timer))
}
