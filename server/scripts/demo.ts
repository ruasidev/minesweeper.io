// Fills a development copy of the site with made-up players, so it can be looked at (and screenshotted) as it would
// be with people in it. With the dev server running:
//
//   npm run demo           the whole thing: makes the players if they aren't there yet, then puts a dozen of them
//                          in live rooms. Runs until stopped (Ctrl-C), or for two hours
//   npm run demo:clear     takes every made-up player, and everything of theirs, out again
//
// The two halves can also be run by themselves, from server/:
//
//   npx tsx scripts/demo.ts seed     made-up players with levels, ratings, leaderboard times, daily challenge
//                                    results and match histories (every game is a real one, so its replay works)
//   npx tsx scripts/demo.ts bots     a dozen of those players in live rooms: playing, chatting, and waiting for
//                                    someone to join them
//
// It only ever touches a database on this machine: every made-up account has an address ending in @demo.invalid,
// and that is all `clear` removes.
import { eq, like } from "drizzle-orm"
import WebSocket from "ws"
import { db, pool } from "../src/db/index.js"
import { dailyAttempt, gameResult, multiplayerResult, profile, user } from "../src/db/schema.js"
import { env } from "../src/env.js"
import { dailyDate, openDailyGame, saveDailyResult } from "../src/multiplayer/daily.js"
import { flag, giveUp, isPlaying, recordOf, reveal, standings, startGame, type Game } from "../src/multiplayer/game.js"
import { DAILY_XP, multiplayerXp, singleplayerXp } from "../src/progression.js"
import { saveRecord, suspicion } from "../src/records.js"
import { BOARD_PRESETS, type BoardSettings, type RoomDetail, type RoomSummary, type ServerMessage } from "../../shared/protocol.js"

const DEMO_DOMAIN = "demo.invalid"
const BOT_PASSWORD = "demo-password-1"
const API = `http://localhost:${env.port}`
const ORIGIN = env.clientOrigin

if (!["localhost", "127.0.0.1", "::1"].includes(new URL(env.databaseUrl).hostname)) {
  console.error("This only runs against a database on this machine.")
  process.exit(1)
}

// The first twelve are the ones who play live (`bots`): they need a password to sign in with
const NAMES = [
  "nightowl", "flagqueen", "sapper99", "pixelmoth", "kestrel", "juno_k", "oddsocks", "lumen", "ziggy", "mapleleaf", "vesper", "rook",
  "mineslayer", "quietsweep", "tessellate", "thedigger", "basalt", "ember", "halcyon", "ironfern", "jade_fox", "kiwi", "lowkey", "mossy",
  "nova", "onyx", "piper", "quill", "sable", "tundra", "umbra", "willow", "xeno", "yarrow", "zephyr", "atlas", "birch", "cinder", "dune",
  "echo_", "fathom", "gale", "hollow", "indigo", "larkspur", "marrow", "nettle", "orbit", "pebble", "ravel", "solace", "thistle",
]
const BOT_COUNT = 12
const BIOS = [
  "sub-60 intermediate or bust", "flags are for cowards", "here for the daily", "I chord everything", "no guess, no glory",
  "learning expert, slowly", "coffee, then mines", "third click always a mine", "playing since the grey box days", "",
  "", "", "rating is just a number", "left side best side", "speed over safety",
]

// The same made-up world every time
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = seeded(20261009)
const between = (low: number, high: number) => low + random() * (high - low)
const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]
const DAY = 24 * 60 * 60 * 1000

// A round picture with the player's initial on it, in two colours of their own: no file, just the address of one
function avatar(name: string, at: number): string {
  const hue = (at * 47) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 70% 35%)"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><text x="32" y="43" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="white" text-anchor="middle">${name[0].toUpperCase()}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// How a made-up player plays: how long they take over a move, and how often they click a mine
type Skill = { paceMs: number, slips: number }

// Plays a player's game out from `from`, a move at a time, as someone would who somehow never guesses wrong except
// when they slip. Returns the moment they stopped
function playOut(game: Game, id: string, from: number, skill: Skill, quitChance = 0): number {
  let now = from
  let last = game.start
  for (let moves = 0; isPlaying(game, id) && moves < 5000; moves++) {
    const cells = game.players.get(id)!.board.grid.flat()
    const covered = cells.filter(cell => !cell.revealed && !cell.hasMine && !cell.flagged)
    if (covered.length === 0) break
    now += skill.paceMs * between(0.5, 1.5)
    const touchesOpen = (cell: typeof cells[number]) => cells.some(other => other.revealed && Math.abs(other.row - cell.row) <= 1 && Math.abs(other.col - cell.col) <= 1)

    if (random() < quitChance) {
      giveUp(game, id, now)
      break
    }
    // now and then a flag on a mine beside what is uncovered
    if (random() < 0.1) {
      const mine = cells.find(cell => cell.hasMine && !cell.flagged && !cell.revealed && touchesOpen(cell))
      if (mine) {
        flag(game, id, mine.row, mine.col, now)
        now += skill.paceMs * 0.4
      }
    }
    if (random() < skill.slips) {
      const mine = cells.find(cell => cell.hasMine && !cell.flagged && !cell.revealed && touchesOpen(cell))
      if (mine) {
        reveal(game, id, mine.row, mine.col, now)
        // sitting out the blast, where the game goes on
        now += 900
        continue
      }
    }
    const next = covered.reduce((best, cell) =>
      Math.hypot(cell.row - last.row, cell.col - last.col) < Math.hypot(best.row - last.row, best.col - last.col) ? cell : best)
    reveal(game, id, next.row, next.col, now)
    last = next
  }
  return now
}

type Person = { id: string, name: string, skill: Skill, xp: number, playSeconds: number, gamesStarted: number, rating: number }

const madeUpPlayers = () => db.select({ id: user.id }).from(user).where(like(user.email, `%@${DEMO_DOMAIN}`))

async function seed() {
  const existing = await madeUpPlayers()
  if (existing.length > 0) {
    console.error(`There are already ${existing.length} made-up players. Run "clear" first to start over.`)
    return
  }
  const now = Date.now()
  const people: Person[] = []

  console.log("Making the players…")
  for (const [at, name] of NAMES.entries()) {
    const email = `${name.replace(/_/g, "")}@${DEMO_DOMAIN}`
    let id = `demo-${name}`
    const joined = new Date(now - between(2, 70) * DAY)
    if (at < BOT_COUNT) {
      // through the site's own sign-up, so that this one can sign in and play
      const response = await fetch(`${API}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: ORIGIN },
        body: JSON.stringify({ name, email, password: BOT_PASSWORD }),
      }).catch(() => null)
      if (!response?.ok) throw new Error(`Could not sign ${name} up: is the dev server running on ${API}?`)
      id = (await response.json() as { user: { id: string } }).user.id
      await db.update(user).set({ image: avatar(name, at), createdAt: joined, emailVerified: true }).where(eq(user.id, id))
    } else {
      await db.insert(user).values({ id, name, email, emailVerified: true, image: avatar(name, at), createdAt: joined, updatedAt: joined })
    }
    // from quick and careful to slow and unlucky
    const talent = random()
    people.push({
      id, name,
      // the quickest take about half a second over a move, the slowest three times that: which puts Intermediate
      // between about three quarters of a minute and two and a half, as it is for people
      skill: { paceMs: 450 + (1 - talent) * 1100, slips: 0.004 + (1 - talent) * 0.02 },
      xp: 0, playSeconds: 0, gamesStarted: 0,
      rating: Math.round(880 + talent * 520 + between(-40, 40)),
    })
  }

  console.log("Playing their singleplayer games…")
  let games = 0
  for (const [at, person] of people.entries()) {
    // two of them have played a great many, for the badge that takes a hundred games
    const count = at === 3 || at === 17 ? 112 : Math.round(between(5, 22))
    for (let n = 0; n < count; n++) {
      const settings: BoardSettings = count > 100 ? BOARD_PRESETS[0].settings : pick([BOARD_PRESETS[0], BOARD_PRESETS[1], BOARD_PRESETS[1], BOARD_PRESETS[2]]).settings
      const started = now - between(0.02, 45) * DAY
      const opening = { row: Math.floor(random() * settings.rows), col: Math.floor(random() * settings.cols) }
      const game = startGame(settings, [person.id], started, { random, opening, startedAt: started, mineEnds: true })
      // in singleplayer a slip is the end of the game, so they are rarer than where a mine only costs time
      const ended = playOut(game, person.id, started, { ...person.skill, slips: person.skill.slips * 0.35 })
      const result = recordOf(game, person.id, ended)!
      const won = result.outcome === "cleared"
      await db.insert(gameResult).values({
        userId: person.id, ...settings, won, durationSeconds: Math.round(result.durationMs / 1000), durationMs: Math.round(result.durationMs),
        verified: true, createdAt: new Date(ended),
      })
      await saveRecord("singleplayer", game, person.id, ended)
      person.xp += won ? singleplayerXp(settings) : 0
      person.playSeconds += result.durationMs / 1000
      person.gamesStarted++
      games++
    }
  }

  console.log("Playing their multiplayer games…")
  for (let n = 0; n < 130; n++) {
    const settings = pick([BOARD_PRESETS[0], BOARD_PRESETS[1], BOARD_PRESETS[1], BOARD_PRESETS[2]]).settings
    const players = [...people].sort(() => random() - 0.5).slice(0, Math.round(between(2, 4.4)))
    const created = now - between(0.02, 45) * DAY
    const game = startGame(settings, players.map(person => person.id), created, { random, rated: random() < 0.75 })
    const ends = new Map(players.map(person => [person.id, playOut(game, person.id, game.startedAt + between(250, 900), person.skill, 0.0012)]))
    const over = Math.max(...ends.values())
    const places = standings(game, over)
    for (const person of players) {
      const result = recordOf(game, person.id, over)!
      const standing = places.find(place => place.playerId === person.id)!
      if (result.outcome === "cleared") {
        await db.insert(multiplayerResult).values({
          userId: person.id, ...settings, durationMs: Math.round(result.durationMs), mineHits: result.mineHits, createdAt: new Date(ends.get(person.id)!),
        })
      }
      await saveRecord("multiplayer", game, person.id, ends.get(person.id)!)
      person.xp += multiplayerXp(settings, { ...standing, playerCount: players.length })
      person.playSeconds += result.durationMs / 1000
      person.gamesStarted++
      games++
    }
  }

  console.log("Playing their daily challenges…")
  const dayStart = (when: number) => Date.parse(`${dailyDate(when)}T00:00:00Z`)
  for (let daysAgo = 9; daysAgo >= 0; daysAgo--) {
    const start = dayStart(now - daysAgo * DAY)
    // today's is only as old as the day is
    const window = daysAgo === 0 ? now - start - 20 * 60 * 1000 : DAY - 30 * 60 * 1000
    if (window <= 0) continue
    for (const [at, person] of people.entries()) {
      // a few never miss a day (and have the badge for it); the rest turn up some days
      if (!(at % 9 === 2) && random() > 0.38) continue
      const opened = start + random() * window
      const daily = await openDailyGame(person.id, opened)
      if (!daily) continue
      const ended = playOut(daily.game, person.id, daily.game.startedAt + between(300, 900), person.skill)
      const result = recordOf(daily.game, person.id, ended)!
      if (result.outcome !== "cleared") continue
      await saveDailyResult(person.id, daily.date, Math.round(result.durationMs), result.mineHits)
      await saveRecord("daily", daily.game, person.id, ended)
      person.xp += DAILY_XP
      person.playSeconds += result.durationMs / 1000
      person.gamesStarted++
      games++
    }
  }

  console.log("Two results nobody could have played, for the admin screen…")
  for (const person of [people[20], people[33]]) {
    const settings = BOARD_PRESETS[2].settings
    const started = now - between(0.1, 3) * DAY
    const game = startGame(settings, [person.id], started, { random, opening: { row: 8, col: 15 }, startedAt: started, mineEnds: true })
    const ended = playOut(game, person.id, started, { paceMs: 22, slips: 0 })
    const result = recordOf(game, person.id, ended)!
    const reason = suspicion(game, result)
    await db.insert(gameResult).values({
      userId: person.id, ...settings, won: true, durationSeconds: Math.round(result.durationMs / 1000), durationMs: Math.round(result.durationMs),
      verified: true, hidden: reason !== null, hiddenReason: reason, createdAt: new Date(ended),
    })
    await saveRecord("singleplayer", game, person.id, ended, { suspectReason: reason })
    games++
  }

  for (const [at, person] of people.entries()) {
    await db.insert(profile).values({
      userId: person.id, username: person.name, bio: BIOS[at % BIOS.length],
      xp: Math.round(person.xp), elo: person.rating, gamesStarted: person.gamesStarted, playSeconds: Math.round(person.playSeconds),
    }).onConflictDoUpdate({
      target: profile.userId,
      set: { username: person.name, bio: BIOS[at % BIOS.length], xp: Math.round(person.xp), elo: person.rating, gamesStarted: person.gamesStarted, playSeconds: Math.round(person.playSeconds) },
    })
  }
  const [{ today }] = [{ today: (await db.select({ userId: dailyAttempt.userId }).from(dailyAttempt).where(eq(dailyAttempt.date, dailyDate(now)))).length }]
  console.log(`Done: ${people.length} players, ${games} games, ${today} of them on today's challenge.`)
}

async function clear() {
  const removed = await db.delete(user).where(like(user.email, `%@${DEMO_DOMAIN}`)).returning({ id: user.id })
  console.log(`Removed ${removed.length} made-up players and everything of theirs.`)
}

// --- Live players -------------------------------------------------------------------------------------------

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const live = Math.random

type Bot = {
  name: string
  id: string
  socket: WebSocket
  rooms: RoomSummary[]
  room: RoomDetail | null
  cells: string | null
  blockedUntil: number
  paceMs: number
  send: (message: object) => void
}

async function signIn(name: string): Promise<Bot> {
  const response = await fetch(`${API}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email: `${name.replace(/_/g, "")}@${DEMO_DOMAIN}`, password: BOT_PASSWORD }),
  })
  if (!response.ok) throw new Error(`${name} couldn't sign in: run "seed" first, with the dev server running`)
  const id = (await response.json() as { user: { id: string } }).user.id
  const cookie = response.headers.getSetCookie().map(part => part.split(";")[0]).join("; ")
  const socket = new WebSocket(`${API.replace(/^http/, "ws")}/api/ws`, { headers: { Cookie: cookie, Origin: ORIGIN } })
  const bot: Bot = {
    name, id, socket, rooms: [], room: null, cells: null, blockedUntil: 0, paceMs: 380 + live() * 520,
    send: message => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)) },
  }
  socket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as ServerMessage
    if (message.type === "rooms") bot.rooms = message.rooms
    if (message.type === "room") bot.room = message.room
    if (message.type === "board") {
      bot.cells = message.cells
      bot.blockedUntil = Date.now() + message.cooldownMs
    }
  })
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject) })
  return bot
}

async function until(condition: () => unknown, timeoutMs: number): Promise<boolean> {
  for (const end = Date.now() + timeoutMs; Date.now() < end;) {
    if (condition()) return true
    await sleep(150)
  }
  return false
}

// The move a careful player would make on what they can see, without knowing where the mines are: a flag on a cell
// that must be a mine, a click on one that can't be, and a guess when there is neither
function nextMove(cells: string, rows: number, cols: number): { type: "reveal" | "flag", row: number, col: number } | null {
  const around = (at: number) => {
    const row = Math.floor(at / cols), col = at % cols, out: number[] = []
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = row + dr, nc = col + dc
      if ((dr || dc) && nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc)
    }
    return out
  }
  const move = (type: "reveal" | "flag", at: number) => ({ type, row: Math.floor(at / cols), col: at % cols })

  for (let at = 0; at < cells.length; at++) {
    if (cells[at] < "1" || cells[at] > "8") continue
    const near = around(at)
    const covered = near.filter(n => cells[n] === ".")
    const mines = near.filter(n => cells[n] === "F" || cells[n] === "*").length
    if (covered.length === 0) continue
    if (Number(cells[at]) === mines) return move("reveal", covered[0])
    if (Number(cells[at]) - mines === covered.length) return move("flag", covered[0])
  }
  const covered = [...cells].flatMap((cell, at) => cell === "." ? [at] : [])
  return covered.length ? move("reveal", covered[Math.floor(live() * covered.length)]) : null
}

// Plays the room's game at a person's pace until this player's part in it is over
async function play(bot: Bot, settings: BoardSettings) {
  while (bot.socket.readyState === WebSocket.OPEN) {
    const game = bot.room?.game
    if (!game || game.over || game.progress[bot.id]?.outcome !== "playing") return
    await sleep(bot.paceMs * (0.5 + live()))
    // nothing to do yet, or sitting out a mine that has just gone off
    if (!bot.cells || Date.now() < bot.blockedUntil) continue
    const move = nextMove(bot.cells, settings.rows, settings.cols)
    if (move) bot.send(move)
  }
}

const ROOM_TALK = ["gg", "nice one", "again?", "that corner got me", "so close", "one more", "wp", "ready when you are", "that opening was rough"]
const GLOBAL_TALK = [
  "anyone up for intermediate?", "today's daily is brutal", "just got my first sub-60", "how do you all chord so fast",
  "room's open if anyone wants a game", "new pb on expert, finally", "that 50/50 at the end hurt", "gg to whoever just beat me",
  "is the daily the same board for everyone?", "yes, same board all day", "love the new themes", "tokyo night gang",
  "who's on the leaderboard grind", "need one more for a 4-player room", "back after a break, what did I miss",
]

type RoomPlan = {
  name: string
  visibility: "public" | "private"
  settings: BoardSettings
  bots: Bot[]
  // sits in the room until someone who isn't one of the made-up players has come in
  waitsForCompany?: boolean
}

async function runRoom({ name, visibility, settings, bots, waitsForCompany }: RoomPlan) {
  const [host, ...others] = bots
  host.send({ type: "createRoom", name, visibility, passcode: visibility === "private" ? "demo-room" : undefined })
  if (!await until(() => host.room, 4000)) throw new Error(`${name}: the room wasn't made`)
  for (const bot of others) {
    bot.send({ type: "joinRoom", roomId: host.room!.id, passcode: "demo-room" })
    await until(() => bot.room, 4000)
  }
  host.send({ type: "setSettings", settings })

  while (host.socket.readyState === WebSocket.OPEN) {
    if (waitsForCompany) await until(() => (host.room?.players.length ?? 0) > bots.length || host.socket.readyState !== WebSocket.OPEN, 24 * 60 * 60 * 1000)
    await sleep(5000 + live() * 5000)
    if (live() < 0.5) pick(bots).send({ type: "chat", text: ROOM_TALK[Math.floor(live() * ROOM_TALK.length)] })
    host.send({ type: "startGame" })
    if (!await until(() => host.room?.game && !host.room.game.over, 4000)) continue
    await sleep(3300)
    await Promise.all(bots.map(bot => play(bot, settings)))
    // whoever isn't one of them may still be playing: the clock on them sees to that
    await until(() => !host.room?.game || host.room.game.over, 11 * 60 * 1000)
    await sleep(1500)
    pick(bots).send({ type: "chat", text: pick(["gg", "gg all", "wp", "nice game"]) })
    await sleep(8000 + live() * 6000)
  }
}

async function bots() {
  console.log("Signing the players in…")
  const players: Bot[] = []
  for (const name of NAMES.slice(0, BOT_COUNT)) players.push(await signIn(name))
  await sleep(500)

  const [beginner, intermediate, expert] = BOARD_PRESETS.map(preset => preset.settings)
  const rooms: RoomPlan[] = [
    { name: "Friday night sweep", visibility: "public", settings: intermediate, bots: players.slice(0, 4) },
    { name: "Expert only", visibility: "public", settings: expert, bots: players.slice(4, 7) },
    { name: "Beginners welcome, come on in", visibility: "public", settings: beginner, bots: players.slice(7, 9), waitsForCompany: true },
    { name: "the usual suspects", visibility: "private", settings: intermediate, bots: players.slice(9, 11) },
  ]
  console.log(`Rooms: ${rooms.map(room => room.name).join(", ")}. "${rooms[2].name}" starts a game once you join it.`)

  // a little talk in the chat everyone shares: a few lines straight away, then one every so often
  const talk = async () => {
    for (let said = 0; players[0].socket.readyState === WebSocket.OPEN; said++) {
      pick(players).send({ type: "globalChat", text: GLOBAL_TALK[said % GLOBAL_TALK.length] })
      await sleep(said < 6 ? 900 : 25_000 + live() * 45_000)
    }
  }

  const closed = new Promise<never>((_, reject) => {
    for (const bot of players) bot.socket.once("close", () => reject(new Error("the server closed the connection")))
  })
  process.once("SIGINT", () => {
    for (const bot of players) bot.socket.close()
    console.log("\nStopped: the players have left.")
    process.exit(0)
  })
  try {
    await Promise.race([closed, talk(), ...rooms.map(runRoom)])
  } finally {
    for (const bot of players) bot.socket.close()
  }
}

const [command] = process.argv.slice(2)
if (command === "start" || command === "seed" || command === "bots") {
  const up = await fetch(`${API}/api/health`).then(response => response.ok, () => false)
  if (!up) {
    console.error(`The dev server isn't answering on ${API}. Start it first (npm run dev:server), and the site (npm run dev).`)
    process.exit(1)
  }
}
if (command === "seed") {
  await seed()
  await pool.end()
} else if (command === "clear") {
  await clear()
  await pool.end()
} else if (command === "start" || command === "bots") {
  // the whole demo makes the players first, unless they are there from last time
  if (command === "start" && (await madeUpPlayers()).length === 0) await seed()
  await pool.end()
  console.log(`\nOpen ${ORIGIN} and sign in as yourself. Ctrl-C here sends the players home; "npm run demo:clear" removes them.\n`)
  // they don't stay for ever if they are forgotten about
  setTimeout(() => {
    console.log("Two hours are up: the players have left. Run it again for more.")
    process.exit(0)
  }, 2 * 60 * 60 * 1000).unref()
  // the dev server restarts whenever its code changes, which drops everyone: they come back and set up again
  for (;;) {
    await bots().catch(error => console.log(`${(error as Error).message}. Starting again in a moment…`))
    await sleep(4000)
  }
} else {
  console.log("Usage: npx tsx scripts/demo.ts <start | seed | bots | clear>")
  await pool.end()
}
