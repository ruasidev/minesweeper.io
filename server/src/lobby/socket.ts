import { upgradeWebSocket } from "@hono/node-server"
import { Hono } from "hono"
import type { WebSocket, WebSocketServer } from "ws"
import { auth } from "../auth.js"
import { env } from "../env.js"
import { getOrCreateProfile } from "../profile.js"
import { CLOSE_OUTDATED, PROTOCOL_VERSION, type Player } from "../../../shared/protocol.js"
import { lobby, type Connection } from "./index.js"

const SOCKET_OPEN = 1

// The game's WebSocket: one per signed-in player, at /api/ws
export const gameSocket = new Hono<{ Variables: { player: Player, outdated: boolean } }>().get(
  "/ws",
  async (c, next) => {
    // A browser sends an account's cookies with a WebSocket request from any site,
    // so a connection is only accepted from the game's own pages
    if (c.req.header("Origin") !== env.clientOrigin) return c.json({ error: "Forbidden" }, 403)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: "Not signed in" }, 401)

    const { username } = await getOrCreateProfile(session.user)
    c.set("player", { id: session.user.id, username, image: session.user.image ?? null })
    // a page from before the last update says an older version of what is spoken here, or none at all
    c.set("outdated", c.req.query("v") !== String(PROTOCOL_VERSION))
    await next()
  },
  upgradeWebSocket((c) => {
    const player = c.get("player")
    const outdated = c.get("outdated")
    let connection: Connection | undefined

    return {
      onOpen(_event, socket) {
        // It is let in only to be told, in a way the page can act on, that it needs loading again
        if (outdated) return socket.close(CLOSE_OUTDATED, "Reload for the new version")
        connection = lobby.connect(player, {
          send: (message) => {
            if (socket.readyState === SOCKET_OPEN) socket.send(JSON.stringify(message))
          },
          close: (code, reason) => socket.close(code, reason),
        })
      },
      onMessage(event) {
        if (connection && typeof event.data === "string") lobby.handleMessage(connection, event.data)
      },
      onClose() {
        if (connection) lobby.disconnect(connection)
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
