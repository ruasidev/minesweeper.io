import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { WebSocketServer } from "ws"
import { auth } from "./auth.js"
import { env } from "./env.js"
import { dropDeadConnections, gameSocket } from "./lobby/socket.js"
import { publicRoutes, routes } from "./routes.js"

const app = new Hono()

// Only the frontend's origin may call the API with cookies
app.use("/api/*", cors({ origin: env.clientOrigin, credentials: true }))

app.get("/api/health", (c) => c.json({ ok: true }))

// Sign up, sign in, sign out, sessions and the Google redirect are all handled by the auth library
app.all("/api/auth/*", (c) => auth.handler(c.req.raw))

app.route("/api", publicRoutes)
app.route("/api", gameSocket)
app.route("/api", routes)

// A game's messages are small; anything much bigger than that is not a real one
const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 })
dropDeadConnections(sockets)

serve({ fetch: app.fetch, port: env.port, websocket: { server: sockets } }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})
